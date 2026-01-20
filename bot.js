require('dotenv').config();
const puppeteer = require('puppeteer-core');
const fs = require('fs');

async function startBot() {
    console.log("Starting Tunnl.io Bot...");
    console.log(`Chrome Path: ${process.env.CHROME_PATH}`);
    // console.log(`User Data Dir: ${process.env.USER_DATA_DIR}`);

    if (!fs.existsSync(process.env.CHROME_PATH)) {
        console.error("Error: Chrome executable not found at specified path. Please update .env");
        return;
    }

    try {
        const browser = await puppeteer.launch({
            executablePath: process.env.CHROME_PATH,
            userDataDir: require('path').join(__dirname, 'session_data'), // Persistent local session
            // userDataDir: process.env.USER_DATA_DIR,
            headless: false,
            defaultViewport: null,
            args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox']
        });

        const pages = await browser.pages();
        const page = pages.length > 0 ? pages[0] : await browser.newPage();

        console.log(`Navigating to ${process.env.TARGET_URL}...`);
        await page.goto(process.env.TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

        console.log("Monitoring for offers...");

        // Keep the script running
        await monitorOffers(page);

    } catch (error) {
        console.error("An error occurred:", error);
        if (error.message.includes("Target closed") || error.message.includes("Session closed")) {
            console.log("Browser was closed or disconnected. Exiting.");
        } else if (error.code === 'ECONNREFUSED') {
            console.log("Could not connect to Chrome. Make sure no other Chrome instances are running with this user profile.");
        }
    }
}

async function monitorOffers(page) {
    // Selectors for elements that might appear when an offer is available
    // Based on the HTML provided, we are looking for:
    // 1. Buttons that are NOT "Request Faucet" or "Launch Boost" or "Raise Dispute"
    // 2. Or the disappearance of "No campaigns available"

    // We will look for ANY button that says "Claim" or "Start" or "View" inside the campaigns area
    const claimButtonSelectors = [
        "button:not([disabled])",
        ".custom-cta-btn"
    ];

    // Helper to check for buttons
    const checkAndClaim = async () => {
        try {
            // Check if "No campaigns available" is present
            const noCampaigns = await page.evaluate(() => {
                return document.body.innerText.includes("No campaigns available");
            });

            if (noCampaigns) {
                // process.stdout.write("."); // heartbeat
                return;
            }

            console.log("\nPotential offer detected! Scanning for buttons...");

            // Logic to find the right button
            const buttons = await page.$$('button');
            for (const button of buttons) {
                const text = await page.evaluate(el => el.innerText, button);
                const buttonHTML = await page.evaluate(el => el.outerHTML, button);

                // Filter out known static buttons
                if (text.includes("Request Faucet") ||
                    text.includes("Launch Boost") ||
                    text.includes("Raise Dispute") ||
                    text.includes("Permit USDC") || // Sticky modal
                    text.includes("Join on Telegram") ||
                    text.includes("Sign out")) {
                    continue;
                }

                console.log(`Found interesting button: "${text}"`);

                // Setup key words for claiming
                const keywords = ["Claim"];
                if (keywords.some(k => text.includes(k))) {
                    console.log(`!!! CLICKING BUTTON: ${text} !!!`);
                    await button.click();
                    console.log("Clicked! Waiting for result...");
                    await new Promise(r => setTimeout(r, 10000)); // Wait a bit after clicking
                    return; // Break loop to re-evaluate page state
                }
            }
        } catch (err) {
            console.log("Error during check loop:", err.message);
        }
    };

    // Poll every 1 second
    setInterval(checkAndClaim, 1000);
}

startBot();
