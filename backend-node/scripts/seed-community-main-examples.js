import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { closeMongo, nextNumericId } from '../src/core/database/mongo.js';

const name = process.env.MONGODB_DB_NAME?.trim();
const uri = process.env.MONGODB_URI?.trim();
if (!uri || name?.toLowerCase() !== 'zflix') throw new Error('Expected the ZFLIX main database');
const tag = 'community-demo-20261113';
const authorName = 'zflix_community_demo';
const examples = [
  { category: 'discussion', title: '[Bài mẫu] Rạp phim hay xem tại nhà?', content: 'Bạn thích trải nghiệm màn ảnh lớn ở rạp hay sự thoải mái khi xem tại nhà? Chia sẻ lý do của bạn nhé.' },
  { category: 'review', title: '[Bài mẫu] Review phim: nhịp kể và nhân vật', content: 'Mình thích cách bộ phim xây dựng nhân vật và giữ nhịp kể đến đoạn cuối. Đây là bài mẫu để thử poster và điểm đánh giá.', rating: 4.5 },
  { category: 'question', title: '[Bài mẫu] Gợi ý phim cho cuối tuần?', content: 'Mình muốn xem một phim có câu chuyện ấm áp và thời lượng vừa phải. Bạn gợi ý phim nào?' },
  { category: 'news', title: '[Bài mẫu] Cùng cập nhật lịch phim mới', content: 'Bài mẫu để kiểm tra loại Tin tức trên feed. Nội dung này chỉ là dữ liệu thử, không phải tin phát hành thực tế.' },
  { category: 'meme', title: '[Bài mẫu] Chỉ xem thêm một tập thôi', content: 'Và rồi đồng hồ báo 3 giờ sáng. Ai từng xem một tập mà thành cả mùa?' },
  { category: 'poll', title: '[Bài mẫu] Tối nay xem thể loại nào?', content: 'Bình chọn thể loại bạn muốn xem nhất.', poll_options: ['Hành động', 'Hài', 'Khoa học viễn tưởng', 'Tâm lý'] },
];

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
try {
  await client.connect();
  const db = client.db(name);
  if (db.databaseName.toLowerCase() !== 'zflix') throw new Error('Unexpected database');
  const [movie, author, existing] = await Promise.all([
    db.collection('productions').findOne({ type: 'movie', poster_url: { $type: 'string', $ne: '' } }, { projection: { id: 1, title: 1, poster_url: 1 } }),
    db.collection('users').findOne({ username: authorName }, { projection: { id: 1, username: 1, email: 1, provider: 1, password: 1, status: 1 } }),
    db.collection('community_posts').find({ tags: tag, content_type: 'community_post' }, { projection: { id: 1, category: 1, title: 1 } }).toArray(),
  ]);
  if (!movie?.id) throw new Error('No real movie with poster found');
  if (author && (author.email !== 'zflix-community-demo@example.invalid' || author.provider !== 'local' || author.password != null || !['disabled', 'active'].includes(author.status))) throw new Error('Demo author identity is unexpected');
  for (const post of existing) if (!examples.some((item) => item.category === post.category && item.title === post.title)) throw new Error('Demo tag is used by an unexpected post');
  if (process.argv.includes('--check')) {
    console.log(`Database: ${db.databaseName}; movie: ${movie.title} (#${movie.id}); existing examples: ${existing.length}/6; demo author: ${author?.status || 'new'}, no password`);
  } else if (process.argv.includes('--apply')) {
    let authorId = author?.id;
    if (!authorId) {
      authorId = await nextNumericId('users');
      await db.collection('users').insertOne({ _id: authorId, id: authorId, username: authorName, email: 'zflix-community-demo@example.invalid', provider: 'local', password: null, status: 'active', role: 'user', created_at: new Date(), updated_at: new Date() });
    }
    if (author?.status === 'disabled') await db.collection('users').updateOne({ id: authorId, username: authorName, email: 'zflix-community-demo@example.invalid', provider: 'local', password: null, status: 'disabled' }, { $set: { status: 'active', updated_at: new Date() } });
    for (const [index, example] of examples.entries()) {
      if (existing.some((post) => post.category === example.category && post.title === example.title)) continue;
      const id = await nextNumericId('community_posts');
      const now = new Date(Date.now() - (examples.length - index) * 60000);
      await db.collection('community_posts').insertOne({ _id: id, id, author_id: authorId, type: 'normal', content_type: 'community_post', visibility: 'public', status: 'active', is_spoiler: false, show_on_movie_page: false, upvotes: 0, downvotes: 0, score: 0, comment_count: 0, tags: [tag], title: example.title, content: example.content, category: example.category, ...(example.category === 'review' && { production_id: movie.id, rating: example.rating }), ...(example.category === 'poll' && { poll_options: example.poll_options }), created_at: now, updated_at: now });
    }
    const ready = await db.collection('community_posts').find({ tags: tag, content_type: 'community_post', status: 'active' }, { projection: { id: 1, category: 1 } }).toArray();
    if (ready.length !== 6 || new Set(ready.map((post) => post.category)).size !== 6) throw new Error(`Expected 6 distinct examples, found ${ready.length}`);
    console.log(`ZFLIX main feed examples: ${ready.map((post) => `${post.category}#${post.id}`).join(', ')}`);
  } else throw new Error('Use --check or --apply');
} finally {
  await client.close();
  await closeMongo();
}
