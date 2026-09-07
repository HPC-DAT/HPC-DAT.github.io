import assert from 'node:assert/strict';
import test from 'node:test';
import { replaceManagedBlock, renderNewsCards, selectNews, summarize } from './sync-news.mjs';

const discussion = (overrides = {}) => ({
	number: 1,
	title: 'Workshop & news',
	body: 'A **short** [summary](https://example.com).\n\nMore detail.',
	createdAt: '2026-09-07T10:00:00Z',
	category: { slug: 'news' },
	...overrides
});

test('selects both migration slugs, sorts newest first, and limits output', () => {
	const items = Array.from({ length: 7 }, (_, index) =>
		discussion({
			number: index,
			createdAt: `2026-09-0${index + 1}T10:00:00Z`,
			category: { slug: index === 0 ? 'general' : index === 1 ? 'announcements' : 'news' }
		})
	);
	assert.deepEqual(selectNews(items).map((item) => item.number), [6, 5, 4, 3, 2]);
});

test('renders safe linked cards and a plain first-paragraph summary', () => {
	const html = renderNewsCards([discussion()]);
	assert.match(html, /Workshop &amp; news/);
	assert.match(html, /A short summary\./);
	assert.match(html, /forum\/d\/1/);
	assert.doesNotMatch(html, /More detail/);
});

test('renders a useful empty state', () => {
	assert.match(renderNewsCards([]), /published here soon/);
});

test('shortens long summaries at a word boundary', () => {
	assert.equal(summarize('alpha beta gamma', 10), 'alpha beta...');
});

test('replaces only the managed block and rejects invalid markers', () => {
	assert.equal(
		replaceManagedBlock(`before\n<!-- news-sync:start -->\nold\n<!-- news-sync:end -->\nafter`, 'new'),
		`before\n<!-- news-sync:start -->\nnew\n\t\t\t\t\t<!-- news-sync:end -->\nafter`
	);
	assert.throws(() => replaceManagedBlock('no markers', 'new'), /marker pair/);
	assert.throws(
		() => replaceManagedBlock(`${'<!-- news-sync:start -->'.repeat(2)}<!-- news-sync:end -->`, 'new'),
		/marker pair/
	);
	assert.throws(
		() => replaceManagedBlock('<!-- news-sync:start --><!-- news-sync:end --><!-- news-sync:end -->', 'new'),
		/marker pair/
	);
});
