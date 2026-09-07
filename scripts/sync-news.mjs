import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const START = '<!-- news-sync:start -->';
const END = '<!-- news-sync:end -->';
const FORUM = 'https://hpc-dat.github.io/forum';

export function summarize(markdown, limit = 280) {
	const paragraph = markdown
		.replace(/<!--.*?-->/gs, '')
		.split(/\n\s*\n/)
		.map((part) => part.trim())
		.find((part) => part && !part.startsWith('#')) ?? '';
	const plain = paragraph
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		.replace(/[*_`~>#]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	if (plain.length <= limit) return plain;
	const shortened = plain.slice(0, limit + 1).replace(/\s+\S*$/, '').trimEnd();
	return `${shortened}...`;
}

export function escapeHtml(value) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

export function selectNews(discussions, limit = 5) {
	return discussions
		.filter((item) => ['news', 'announcements'].includes(item.category?.slug))
		.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
		.slice(0, limit);
}

export function renderNewsCards(discussions) {
	const news = selectNews(discussions);
	if (news.length === 0) {
		return '\t\t\t\t\t<p class="news-empty">News will be published here soon.</p>';
	}
	return news
		.map((item) => {
			const date = new Intl.DateTimeFormat('en-GB', {
				day: 'numeric',
				month: 'long',
				year: 'numeric',
				timeZone: 'UTC'
			}).format(new Date(item.createdAt));
			const url = `${FORUM}/d/${item.number}`;
			return [
				'\t\t\t\t\t<article class="news-card">',
				`\t\t\t\t\t\t<p class="news-meta">${escapeHtml(date)}</p>`,
				`\t\t\t\t\t\t<h3><a href="${url}">${escapeHtml(item.title)}</a></h3>`,
				`\t\t\t\t\t\t<p>${escapeHtml(summarize(item.body))}</p>`,
				`\t\t\t\t\t\t<a class="news-link" href="${url}">Read and discuss &rarr;</a>`,
				'\t\t\t\t\t</article>'
			].join('\n');
		})
		.join('\n');
}

export function replaceManagedBlock(document, generated) {
	const start = document.indexOf(START);
	const end = document.indexOf(END);
	if (
		start < 0 ||
		end < 0 ||
		end <= start ||
		document.indexOf(START, start + 1) >= 0 ||
		document.indexOf(END, end + 1) >= 0
	) {
		throw new Error('Expected exactly one valid news-sync marker pair');
	}
	const contentStart = start + START.length;
	return `${document.slice(0, contentStart)}\n${generated}\n\t\t\t\t\t${document.slice(end)}`;
}

export async function syncNews(sourcePath, targetPath) {
	const source = JSON.parse(await readFile(sourcePath, 'utf8'));
	if (!Array.isArray(source.discussions)) throw new Error('Forum archive has no discussions array');
	const current = await readFile(targetPath, 'utf8');
	const next = replaceManagedBlock(current, renderNewsCards(source.discussions));
	if (next === current) return false;
	await writeFile(targetPath, next);
	return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const source = process.argv[2] ?? '_forum-data/posts/index.json';
	const target = process.argv[3] ?? 'index.html';
	const changed = await syncNews(source, target);
	console.log(changed ? 'Updated website news' : 'Website news is already current');
}
