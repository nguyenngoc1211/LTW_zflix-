import { useState } from "react";

const ToxicComment = ({ content, isToxic, className = "", children }) => {
  const [revealed, setRevealed] = useState(false);
  const hidden = Boolean(isToxic) && !revealed;

  return (
    <div
      className={`toxic-comment ${hidden ? "is-hidden" : ""} ${className}`.trim()}
      onClick={() => hidden && setRevealed(true)}
      onKeyDown={(event) => {
        if (hidden && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          setRevealed(true);
        }
      }}
      role={hidden ? "button" : undefined}
      tabIndex={hidden ? 0 : undefined}
      aria-label={hidden ? "Bình luận có thể chứa nội dung không phù hợp. Nhấn để xem." : undefined}
    >
      <div className={hidden ? "toxic-comment-text" : ""}>
        {children || <p>{content}</p>}
      </div>
      {hidden && (
        <div className="toxic-comment-cover">
          <strong>⚠ Bình luận có thể chứa nội dung không phù hợp.</strong>
          <span>Nhấn để xem nội dung</span>
        </div>
      )}
    </div>
  );
};

export default ToxicComment;
