/* 
Our task today

Let's scrape Facebook comments

Why?

So we can find the top Boomers of Facebook
*/
const fs = require("fs");
const puppeteer = require("puppeteer");

const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'))

let locations = JSON.parse(fs.readFileSync('./locations.json', 'utf-8'))

locations = locations.filter((loc) => {
	return !!loc.pageLink
});

function timeout(miliseconds) {
	return new Promise((resolve) => {
		setTimeout(() => {resolve()}, miliseconds)
	})
}

// function expression
const setupBrowser = async () => {
  const viewportHeight = 1024;
  const viewportWidth = 1080;
  const browser = await puppeteer.launch({ headless: false });

  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(0); 
  await page.setViewport({width: viewportWidth, height: viewportHeight});
  
  page.on('console', async (msg) => {
	const msgArgs = msg.args();
	for (let i = 0; i < msgArgs.length; ++i) {
	  try {
		console.log(await msgArgs[i].jsonValue());
	  } catch(e) {
	  	console.log(e);
	  }
    }
  });

  return [browser, page]
}

async function facebookLogin(page) {
	await page.goto('https://facebook.com')

	await page.waitForSelector("#email");
	await page.focus("#email")
	await page.keyboard.type(config.username)


	await page.focus("#pass")
	await page.keyboard.type(config.password)


	const submitButton = await page.evaluate(() => {
		const submitButton = document.querySelector("[type=\"submit\"]")
		console.log("ELEMENT", submitButton);
		submitButton.click();
	});

	// press enter
	await timeout(5000)
}

async function getPageComments(page, pageLink) {
	const commentLimit = 50;
	let allComments = [];

	await page.goto(pageLink)

	await page.waitForSelector("[aria-label=\"Close\"]")
	await page.evaluate(() => {
		const closeBtn = document.querySelector("[aria-label=\"Close\"]")
		closeBtn.click()
	});

	

	// we need to do loop
	await page.evaluate(() => {
		window.scrollBy(0, 2000);
	});
	await timeout(1000);
	await page.waitForSelector("[role=\"article\"] [role=\"link\"]")
	await timeout(1000);	

	const comments = await page.evaluate(async (commentLimit) => {
		function timeout(miliseconds) {
			return new Promise((resolve) => {
				setTimeout(() => {resolve()}, miliseconds)
			})
		}

		const commentsLinks = Array.from(document.querySelectorAll("[role=\"article\"]")).map((article) => {
			return article.querySelector("div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(1) > div:nth-child(1) > div:nth-child(4) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(1) [role=\"button\"]")
		}).filter((commentLink) => {
			return !!commentLink
		});

		let comments = []
		function waitFor(selector) {
			return new Promise((resolve) => {
				const limit = 10000
				let intervalAccumulator = 0;
				const interval = 100
				let foundElement;

				const waitInterval = setInterval(() => {
					if (intervalAccumulator >= limit) {
						broken = true
						clearInterval(waitInterval)
						resolve(null);
					}

					foundElement = document.querySelector(selector);
					if (foundElement) {
						clearInterval(waitInterval)
						resolve(foundElement);
					}

					intervalAccumulator += interval;
				}, interval);
			})
		}

		for (let commentLink of commentsLinks) {
			commentLink.click()

			await waitFor("[role=\"dialog\"] li [role=\"article\"]");

			const articleText = document.querySelector("[role=\"dialog\"] [role=\"article\"]").innerText 

			const allCommentTextRaw = Array.from(document.querySelectorAll("[role=\"dialog\"] li [role=\"article\"]")).map((comment) => comment.innerText)	
			const newComments = allCommentTextRaw.map((commentTextRaw) => {
				const commentSplit = commentTextRaw.split("\n");
				if (commentSplit.length <= 2) {
					return { comment: commentSplit[0], name: commentSplit[0], context: articleText }
				} else {
					const comment = commentSplit.slice(1, commentSplit.length - 1).join(" ")
					return { comment, name: commentSplit[0], context: articleText }
				}
			});

			comments = comments.concat(newComments)
			if (comments.length >= commentLimit) {
				const closeBtn = document.querySelector("[aria-label=\"Close\"]");
				closeBtn.click();
				return comments
			} else {
				const closeBtn = document.querySelector("[aria-label=\"Close\"]");
				closeBtn.click();	
			}
		}
	}, commentLimit);

	allComments = allComments.concat(comments);
	console.log(comments)
	// end loop
	return allComments
}

async function run() {
	const [browser, page] = await setupBrowser();

	// await facebookLogin(page);
	for (let location of locations) {
		const comments = await getPageComments(page, location.pageLink)
		console.log(comments)
	}

	process.exit(0);
}

run()

