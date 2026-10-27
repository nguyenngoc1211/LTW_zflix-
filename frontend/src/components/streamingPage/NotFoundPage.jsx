import { Button, Result } from "antd";
import { useNavigate } from "react-router-dom";

const NotFoundPage = () => {
  const navigate = useNavigate();
  return (
    <Result
      status="404"
      title={<span className="text-black font-bold text-3xl">404</span>}
      subTitle={<span className="text-black">Trang này không tồn tại</span>}
      extra={
        <Button
          type="primary"
          onClick={() => {
            navigate("/");
          }}
        >
          Trang chủ
        </Button>
      }
    />
  );
};
export default NotFoundPage;
