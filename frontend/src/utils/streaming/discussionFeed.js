export function mergeDiscussion(comments, posts, page, pageSize = 12) {
  const entries = [
    ...comments.map((item) => ({ type: 'comment', item })),
    ...posts.map((item) => ({ type: 'post', item })),
  ];
  entries.sort((a, b) => {
    const diff = (Date.parse(b.item.created_at) || 0) - (Date.parse(a.item.created_at) || 0);
    return diff || a.type.localeCompare(b.type) || Number(b.item.id) - Number(a.item.id);
  });
  return { items: entries.slice((page - 1) * pageSize, page * pageSize), hasMore: entries.length > page * pageSize };
}
