require('dotenv').config();
const puppeteer = require('puppeteer-core');

(async () => {
    console.log("Debug: Attempting to launch Chrome...");
    console.log(`Path: ${process.env.CHROME_PATH}`);
    console.log(`Profile: ${process.env.USER_DATA_DIR}`);

    try {
        const browser = await puppeteer.launch({
            executablePath: process.env.CHROME_PATH,
            userDataDir: process.env.USER_DATA_DIR,
            headless: false,
            args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox']
        });
        console.log("Debug: Success! Browser launched.");
        await browser.close();
        console.log("Debug: Browser closed.");
    } catch (e) {
        console.error("Debug: Launch Failed!");
        console.error(e);
    }
})();
