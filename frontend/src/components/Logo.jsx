const Logo = (props) => {
  const { theme } = props;
  return (
    <span
      className={`text-2xl font-black tracking-tight ${
        theme == "dark" ? "text-white" : "text-black"
      }`}
    >
      Z<span className="text-[#e50914]">FLIX</span>
    </span>
  );
};

export default Logo;
