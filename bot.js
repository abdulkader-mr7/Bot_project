require('dotenv').config();
const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function startBot() {
    console.log("🚀 Starting Tunnl Claim Bot");

    if (!fs.existsSync(process.env.CHROME_PATH)) {
        console.error("❌ Invalid Chrome path");
        return;
    }

    const browser = await puppeteer.launch({
        executablePath: process.env.CHROME_PATH,
        headless: false,
        defaultViewport: null,
        userDataDir: path.join(__dirname, 'session_data'),
        args: ['--start-maximized']
    });

    const [page] = await browser.pages();
    await page.goto(process.env.TARGET_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
    });

    await monitor(page);
}

async function monitor(page) {
    console.log("👀 Monitoring for active campaigns...");

    const INTERVAL = 1200;
    let busy = false;

    const REFRESH_INTERVAL = 30000; // 30 seconds
    let lastReload = Date.now();

    setInterval(async () => {
        if (busy) return;

        // 🔄 Auto-Refresh: Reload page every 30 seconds to find new campaigns
        if (Date.now() - lastReload > REFRESH_INTERVAL) {
            console.log("🔄 Refreshing page to check for new campaigns...");
            busy = true;
            try {
                await page.reload({ waitUntil: 'domcontentloaded' });
                lastReload = Date.now();
            } catch (e) {
                console.error("Error reloading:", e.message);
            }
            busy = false;
            return;
        }

        // 🛡️ Auto-Redirect: Ensure we stay on the campaigns page
        // If the user wanders off to 'Home' or 'Profile', bring them back
        const currentUrl = page.url();
        if (!currentUrl.includes('campaigns') && !currentUrl.includes('campaign-details')) {
            console.log("⚠️ Not on campaigns page. Redirecting...");
            try {
                await page.goto(process.env.TARGET_URL, { waitUntil: 'domcontentloaded' });
            } catch (e) { console.log("Redirect error (ignoring):", e.message); }
            return;
        }

        try {
            // Ignore empty state
            const noCampaigns = await page.evaluate(() =>
                document.body.innerText.includes('No campaigns available')
            );
            if (noCampaigns) return;

            // Find ACTIVE cards only
            const cards = await page.$$('.radial-gradient-border.cursor-pointer');
            if (cards.length > 0) console.log(🔎 Found ${cards.length} potential cards);
            if (!cards.length) return;

            for (const card of cards) {
                const text = (await page.evaluate(el => el.innerText, card)).toLowerCase();

                if (
                    text.includes('past') ||

                    text.includes('unable to claim')
                ) {
                    continue;
                }

                busy = true;

                // 👉 CLICK ACTIVE CARD
                const box = await card.boundingBox();
                await page.mouse.click(
                    box.x + box.width / 2,
                    box.y + box.height / 2
                );

                console.log("📦 Active campaign opened");

                try {
                    // 👉 CHECK REMAINING REWARDS
                    try {
                        const remainingUsdc = await page.evaluate(() => {
                            // Find 'Remaining Rewards' label
                            const label = [...document.querySelectorAll('span')]
                                .find(el => el.innerText.trim() === 'Remaining Rewards');

                            if (!label) return null;

                            // Navigate to the values container (usually the next major block)
                            // Based on structure: Label -> Parent -> Sibling Container -> Child -> Child -> Value
                            // We scan for the first "X USDC" pattern that appears after the label in the DOM

                            // Get all text content after the label in the sidebar
                            // This is a bit rough, but effective if the layout is consistent
                            // Easier: Traverse up to the card container and find the relevant value

                            // Let's look for the value structurally relative to the label if possible
                            // The HTML shows the value is in a div that follows the label's container.

                            // Try to find the closest common container for checks
                            const sidebar = document.querySelector('nav') || document.body;
                            const text = sidebar.innerText;
                            const remainingIndex = text.indexOf('Remaining Rewards');
                            if (remainingIndex === -1) return null;

                            // Look for the number pattern after "Remaining Rewards"
                            // The text likely reads: "Remaining Rewards\n...\n0.00 Tickets\n0 USDC"
                            const afterText = text.slice(remainingIndex);
                            const match = afterText.match(/(\d+(\.\d+)?) USDC/);

                            if (match) {
                                return parseFloat(match[1]);
                            }
                            return null;
                        });

                        if (remainingUsdc !== null) {
                            console.log(💰 Remaining Rewards: ${remainingUsdc} USDC);
                            if (remainingUsdc <= 9) {
                                console.log(⚠️ Skipping: Reward ${remainingUsdc} USDC is <= 9 USDC);
                                throw new Error("LOW_REWARD");
                            }
                        } else {
                            console.log("⚠️ Could not verify remaining rewards. Proceeding with caution...");
                        }
                    } catch (e) {
                        if (e.message === "LOW_REWARD") {
                             await page.goto(process.env.TARGET_URL, { waitUntil: 'domcontentloaded' });
                             continue;
                        }
                        console.log("Error checking rewards:", e.message);
                    }

                    // 👉 WAIT FOR CLAIM OFFER BUTTON (Max 5 seconds)
                    await page.waitForFunction(() => {
                        const btn = [...document.querySelectorAll('button.custom-cta-btn')]
                            .find(b => b.innerText.trim() === 'Claim Offer');
                        return btn && !btn.disabled;
                    }, { timeout: 10000 });

                    // 👉 CLICK CLAIM OFFER
                    const claimed = await page.evaluate(() => {
                        const btn = [...document.querySelectorAll('button.custom-cta-btn')]
                            .find(b =>
                                b.innerText.trim() === 'Claim Offer' &&
                                !b.disabled
                            );
                        if (btn) {
                            btn.click();
                            return true;
                        }
                        return false;
                    });

                    if (claimed) {
                        console.log("🎉 CLAIM OFFER CLICKED");
                    }
                } catch (e) {
                    console.log("ℹ️ Claim button not found or timed out. Moving on.");
                }

                await new Promise(r => setTimeout(r, 5000));

                // 🔙 Navigate back to campaigns page
                console.log("🔙 Returning to campaigns page...");
                await page.goto(process.env.TARGET_URL, { waitUntil: 'domcontentloaded' });

                busy = false;
                return;
            }

        } catch (err) {
            console.error("⚠ Error:", err.message);
            busy = false;
        }
    }, INTERVAL);
}

startBot();