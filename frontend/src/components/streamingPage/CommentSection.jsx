import { Avatar, Input, Button } from "antd";
import { UserOutlined, SendOutlined } from "@ant-design/icons";

const CommentSection = () => {
  const comments = [
    {
      id: 1,
      user: "Peterpan",
      time: "an hour ago",
      content: "When does the dub come out 😭",
      avatar: "https://xsgames.co/randomusers/assets/avatars/male/1.jpg",
    },
    {
      id: 2,
      user: "Emma_Chan",
      time: "4 hours ago",
      content: "This episode is fire! 🔥🔥🔥",
      avatar: "https://xsgames.co/randomusers/assets/avatars/female/2.jpg",
    },
  ];

  return (
    <div className="mt-8">
      <h3 className="text-pink-500 font-bold text-lg mb-4">Comments</h3>

      {/* Input */}
      <div className="bg-[#18181b] p-4 rounded-xl border border-gray-800 mb-6 flex gap-3">
        <Avatar icon={<UserOutlined />} className="bg-gray-700" />
        <div className="flex-1 relative">
          <Input.TextArea
            placeholder="Leave a comment..."
            autoSize={{ minRows: 2, maxRows: 4 }}
            className="bg-[#121212] border-gray-700 text-white placeholder-gray-600 mb-2"
          />
          <div className="flex justify-end">
            <Button
              type="primary"
              size="small"
              icon={<SendOutlined />}
              className="bg-pink-600 border-none"
            >
              Comment
            </Button>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col gap-4">
        {comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <Avatar src={c.avatar} />
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-gray-200 font-bold text-sm">
                  {c.user}
                </span>
                <span className="text-gray-600 text-xs">{c.time}</span>
              </div>
              <p className="text-gray-400 text-sm bg-[#18181b] p-2 rounded-lg inline-block border border-gray-800">
                {c.content}
              </p>
              <div className="flex gap-3 mt-1 ml-1 text-xs text-gray-500 font-medium cursor-pointer">
                <span className="hover:text-white">Reply</span>
                <span className="hover:text-white">Like</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CommentSection;
