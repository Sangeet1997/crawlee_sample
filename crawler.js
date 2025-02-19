import { PlaywrightCrawler, Dataset } from 'crawlee';
import { chromium } from 'playwright';
import { execSync } from 'child_process';


// First, ensure browser is installed
async function ensureBrowser() {
    try {
        await chromium.launch();
    } catch (error) {
        console.log('Installing browser dependencies...');
        execSync('npx playwright install chromium', { stdio: 'inherit' });
    }
}

// Configuration object for the crawler
const config = {
    maxRequestsPerCrawl: 50,
    maxConcurrency: 10,
    // Add browser launch options
    launchContext: {
        launchOptions: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        },
    },
};

// Initialize the crawler
const crawler = new PlaywrightCrawler({
    ...config,
    
    // This function will be called for each page
    async requestHandler({ page, request, enqueueLinks, log }) {
        log.info(`Processing ${request.url}`);
        
        try {
            // Wait for the content to load with timeout
            await page.waitForLoadState('networkidle', { timeout: 30000 });
            
            // Example selectors - modify these based on the website you're scraping
            const data = await page.evaluate(() => {
                return {
                    title: document.querySelector('h1')?.innerText,
                    description: document.querySelector('meta[name="description"]')?.content,
                    paragraphs: Array.from(document.querySelectorAll('p')).map(p => p.innerText),
                    links: Array.from(document.querySelectorAll('a')).map(a => a.href),
                };
            });
            
            // Save the results
            await Dataset.pushData({
                url: request.url,
                ...data,
                timestamp: new Date().toISOString(),
            });
            
            // Find links on the page and add them to the queue
            await enqueueLinks({
                strategy: 'same-domain',
                transformRequestFunction: (req) => {
                    if (req.url.match(/\.(jpg|jpeg|png|gif|pdf)$/i)) {
                        return false;
                    }
                    return req;
                },
            });
        } catch (error) {
            log.error(`Error processing ${request.url}: ${error.message}`);
        }
    },
    
    // Handle failures
    failedRequestHandler({ request, log }) {
        log.error(`Request ${request.url} failed`);
    },
});

// Function to start the crawler
async function startCrawling(startUrl) {
    try {
        console.log('Ensuring browser is installed...');
        await ensureBrowser();
        
        console.log('Starting the crawler...');
        await crawler.run([startUrl]);
        console.log('Crawler finished');
    } catch (error) {
        console.error('Crawler failed:', error);
    }
}

// Usage example
const startUrl = 'https://en.wikipedia.org/wiki/Web_scraping';
startCrawling(startUrl);