// Topic names in web addresses: "Profit and loss" is /practice/profit-and-loss on the website and
// ?practice=profit-and-loss in the app. Shared so both always agree.
export const topicSlug = (label) => String(label).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
