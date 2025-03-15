import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Use the StealthPlugin to avoid detection
puppeteer.use(StealthPlugin());

export const getNseData = async (req, res) => {
  try {
    // Launch Puppeteer in headless mode
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Set extra HTTP headers to mimic a real browser
    await page.setExtraHTTPHeaders({
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    });

    // Navigate to the NSE live equity market page
    await page.goto('https://www.nseindia.com/market-data/live-equity-market', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    console.log('Page loaded successfully');

    // Wait for the table to load
    await page.waitForSelector('table tr');

    // Extract data from the table rows
    const tableData = await page.evaluate(() => {
      // Select all rows in the table
      const rows = document.querySelectorAll('tr');
      const data = [];

      rows.forEach((row) => {
        // Extract data from each column (td elements)
        const columns = row.querySelectorAll('td');
        if (columns.length > 0) {
          data.push({
            symbol: columns[0]?.innerText.trim(),
            lastPrice: columns[1]?.innerText.trim(),
            high: columns[2]?.innerText.trim(),
            low: columns[3]?.innerText.trim(),
            ltp: columns[4]?.innerText.trim(),
            volume: columns[9]?.innerText.trim(),
            turnover: columns[10]?.innerText.trim(),
          });
        }
      });

      return data;
    });

    // Close the browser
    await browser.close();

    // Send the extracted data as a response
    res.status(200).json({ success: true, data: tableData });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch NSE data' });
  }
};