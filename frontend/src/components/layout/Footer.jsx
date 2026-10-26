import React from 'react';
import { Link } from 'react-router-dom';
import { FaFacebook, FaYoutube, FaInstagram, FaTiktok } from 'react-icons/fa';

const Footer = () => {
    return (
        <footer className="bg-black border-t border-gray-800 pt-16 pb-8 mt-auto">
            <div className="max-w-[1600px] mx-auto px-6 lg:px-12">

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
                    {/* Col 1: Brand */}
                    <div className="space-y-4">
                        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-500 tracking-tighter">
                            CINEWAVE
                        </h2>
                        <p className="text-gray-400 text-sm leading-relaxed">
                            Trải nghiệm điện ảnh đỉnh cao ngay tại nhà. Kho phim khổng lồ, chất lượng 4K, không quảng cáo làm phiền.
                        </p>
                        <div className="flex gap-4 pt-2">
                            <SocialIcon icon={<FaFacebook />} />
                            <SocialIcon icon={<FaYoutube />} />
                            <SocialIcon icon={<FaInstagram />} />
                            <SocialIcon icon={<FaTiktok />} />
                        </div>
                    </div>

                    {/* Col 2: Khám phá */}
                    <div>
                        <h3 className="text-white font-bold mb-6">Khám phá</h3>
                        <ul className="space-y-3 text-sm text-gray-400">
                            <li><Link to="/movies" className="hover:text-teal-400 transition-colors">Phim lẻ mới</Link></li>
                            <li><Link to="/series" className="hover:text-teal-400 transition-colors">Phim bộ độc quyền</Link></li>
                            <li><Link to="/charts" className="hover:text-teal-400 transition-colors">Bảng xếp hạng</Link></li>
                            <li><Link to="/coming-soon" className="hover:text-teal-400 transition-colors">Sắp chiếu</Link></li>
                        </ul>
                    </div>

                    {/* Col 3: Hỗ trợ */}
                    <div>
                        <h3 className="text-white font-bold mb-6">Hỗ trợ</h3>
                        <ul className="space-y-3 text-sm text-gray-400">
                            <li><Link to="/help" className="hover:text-teal-400 transition-colors">Trung tâm trợ giúp</Link></li>
                            <li><Link to="/plans" className="hover:text-teal-400 transition-colors">Gói dịch vụ</Link></li>
                            <li><Link to="/faq" className="hover:text-teal-400 transition-colors">Câu hỏi thường gặp</Link></li>
                            <li><Link to="/contact" className="hover:text-teal-400 transition-colors">Liên hệ</Link></li>
                        </ul>
                    </div>

                    {/* Col 4: Thông tin */}
                    <div>
                        <h3 className="text-white font-bold mb-6">Thông tin</h3>
                        <ul className="space-y-3 text-sm text-gray-400">
                            <li><Link to="/terms" className="hover:text-teal-400 transition-colors">Điều khoản sử dụng</Link></li>
                            <li><Link to="/privacy" className="hover:text-teal-400 transition-colors">Chính sách bảo mật</Link></li>
                            <li><Link to="/copyright" className="hover:text-teal-400 transition-colors">Bản quyền</Link></li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-gray-600 text-xs">
                        © 2026 Cinewave Inc. All rights reserved.
                    </p>
                    <div className="flex gap-6 text-gray-600 text-xs">
                        <span>Vietnam</span>
                        <span>English</span>
                    </div>
                </div>
            </div>
        </footer>
    );
};

// Component nhỏ cho icon xã hội
const SocialIcon = ({ icon }) => (
    <div className="w-9 h-9 bg-gray-900 rounded-full flex items-center justify-center text-gray-400 hover:bg-teal-600 hover:text-white transition-all cursor-pointer">
        {icon}
    </div>
);

export default Footer;