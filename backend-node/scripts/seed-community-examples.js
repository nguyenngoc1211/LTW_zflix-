import 'dotenv/config';
import { MongoClient } from 'mongodb';

const testName = process.env.COMMUNITY_TEST_DB_NAME?.trim();
const primaryName = process.env.MONGODB_DB_NAME?.trim();
const testUri = process.env.COMMUNITY_TEST_MONGODB_URI?.trim();
if (!testUri || testName !== 'community_test_schema_20261101' || testName.toLowerCase() === primaryName?.toLowerCase() || testName.toLowerCase() === 'zflix') {
  throw new Error('Refusing to seed outside the dedicated Community test database');
}

const userId = 2147482700;
const movieId = 2147482701;
const baseId = 2147482710;
const now = Date.now();
const examples = [
  { category: 'discussion', title: 'Bạn thích xem phim ở rạp hay tại nhà?', content: 'Mình thích âm thanh và màn hình lớn ở rạp, nhưng xem tại nhà thì dễ tạm dừng để bàn luận. Mọi người chọn cách nào và vì sao?', offset: 5 },
  { category: 'review', title: 'Review phim mẫu: nhịp kể và nhân vật', content: 'Một câu chuyện có mở đầu chậm nhưng càng về cuối càng cuốn. Mình thích cách nhân vật chính thay đổi sau mỗi lựa chọn. Đây là bài review mẫu để thử thẻ phim và điểm sao.', production_id: movieId, rating: 4.5, offset: 4 },
  { category: 'question', title: 'Có phim nào phù hợp để xem cuối tuần?', content: 'Mình muốn tìm một phim có nhịp vừa phải, cốt truyện ấm áp và không quá dài. Gợi ý của bạn là gì?', offset: 3 },
  { category: 'news', title: 'Tin tức mẫu: cùng chia sẻ lịch phim mới', content: 'Đây là bài Tin tức mẫu dùng để kiểm tra bộ lọc và cách hiển thị trong bảng tin. Hãy thay bằng tin có nguồn xác thực khi đăng thật.', offset: 2 },
  { category: 'meme', title: 'Meme: khi nói chỉ xem thêm một tập', content: 'Và rồi đồng hồ báo 3 giờ sáng. Ai từng định xem một tập mà xem hết cả mùa?', offset: 1 },
  { category: 'poll', title: 'Tối nay cả nhóm nên xem thể loại nào?', content: 'Chọn một thể loại để thử bình chọn. Mỗi tài khoản chỉ có một lượt.', poll_options: ['Hành động', 'Hài', 'Khoa học viễn tưởng', 'Tâm lý'], offset: 0 },
];

const client = new MongoClient(testUri, { serverSelectionTimeoutMS: 10000 });
try {
  await client.connect();
  const db = client.db(testName);
  if (db.databaseName !== testName || db.databaseName.toLowerCase() === 'zflix') throw new Error('Unsafe database selected');
  const ids = examples.map((_, index) => baseId + index);
  const [existingUsers, existingMovies, existingPosts] = await Promise.all([
    db.collection('users').findOne({ _id: userId }),
    db.collection('productions').findOne({ _id: movieId }),
    db.collection('community_posts').find({ _id: { $in: ids } }, { projection: { _id: 1, category: 1 } }).toArray(),
  ]);
  if (existingUsers && existingUsers.username !== 'zflix_community_demo') throw new Error('Reserved demo user ID is occupied');
  if (existingMovies && existingMovies.title !== 'Phim mẫu ZFLIX') throw new Error('Reserved demo movie ID is occupied');
  for (const post of existingPosts) {
    if (post.category !== examples[post._id - baseId]?.category) throw new Error(`Reserved demo post ID ${post._id} is occupied`);
  }
  if (process.argv.includes('--check')) {
    console.log(`Safe test database: ${db.databaseName}; existing sample posts: ${existingPosts.length}/6`);
    process.exitCode = 0;
  } else {
    await db.collection('users').updateOne({ _id: userId }, { $setOnInsert: { _id: userId, id: userId, username: 'zflix_community_demo', email: 'community-demo@example.invalid', status: 'active', role: 'user' } }, { upsert: true });
    await db.collection('productions').updateOne({ _id: movieId }, { $setOnInsert: { _id: movieId, id: movieId, type: 'movie', title: 'Phim mẫu ZFLIX', release_year: 2026, status: 'completed' } }, { upsert: true });
    for (let index = 0; index < examples.length; index++) {
      const { offset, ...fields } = examples[index];
      const id = baseId + index;
      const createdAt = new Date(now - offset * 3600000);
      await db.collection('community_posts').updateOne({ _id: id }, { $setOnInsert: { _id: id, id, author_id: userId, type: 'normal', content_type: 'community_post', visibility: 'public', status: 'active', is_spoiler: false, show_on_movie_page: false, upvotes: 0, downvotes: 0, score: 0, comment_count: 0, created_at: createdAt, updated_at: createdAt, ...fields } }, { upsert: true });
    }
    const seeded = await db.collection('community_posts').find({ _id: { $in: ids }, content_type: 'community_post', status: 'active' }, { projection: { _id: 1, category: 1 } }).sort({ _id: 1 }).toArray();
    if (seeded.length !== 6) throw new Error(`Expected 6 visible Community examples, found ${seeded.length}`);
    console.log(`Community test examples ready in ${db.databaseName}: ${seeded.map((post) => `${post.category}#${post._id}`).join(', ')}`);
  }
} finally {
  await client.close();
}
