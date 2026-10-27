/* eslint-disable no-unused-vars */
import React from "react";
import { Link } from "react-router-dom";
import { FaPlay, FaInfoCircle, FaStar } from "react-icons/fa";

const HomePage = () => {
  // Hero anime background - bright banner from reliable source
  const heroBackground =
    "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1920&q=80"; // Anime style bright

  // Featured anime list with brighter images
  const featuredAnime = [
    {
      id: 1,
      title: "Your Name",
      rating: 9.4,
      image:
        "https://m.media-amazon.com/images/M/MV5BNGYyNmI3M2YtNzYzZS00OTViLTkxYjAtZDIyZmE1YzBmZTJhXkEyXkFqcGdeQXVyMTA4NjE0NjEy._V1_.jpg",
    },
    {
      id: 2,
      title: "Spy x Family",
      rating: 9.0,
      image:
        "https://m.media-amazon.com/images/M/MV5BNDM4YzY1M2UtNmViZS00MzExLWJkOTktZDY1YjdjYjM1ZjIxXkEyXkFqcGdeQXVyMTMzNDExODE5._V1_.jpg",
    },
    {
      id: 3,
      title: "Demon Slayer",
      rating: 9.5,
      image:
        "https://m.media-amazon.com/images/M/MV5BZjZjNzI5MDctY2Y4YS00NmM4LTljMmItZTFkOTExNGI3ODRhXkEyXkFqcGdeQXVyNjc3MjQzNTI@._V1_.jpg",
    },
    {
      id: 4,
      title: "One Punch Man",
      rating: 9.1,
      image:
        "https://m.media-amazon.com/images/M/MV5BZjJlNzE5YzEtYzQwYS00NTI1LWFiYzMtMTRlNjgxYjBjNTczXkEyXkFqcGdeQXVyNTgyNTA4MjM@._V1_.jpg",
    },
    {
      id: 5,
      title: "Jujutsu Kaisen",
      rating: 8.8,
      image:
        "https://m.media-amazon.com/images/M/MV5BNTEyNjY4MTQtM2U5Yy00OWU4LWJmMTctOGE4OGIxMjdiMWM5XkEyXkFqcGc@._V1_.jpg",
    },
  ];

  return (
    <div className="min-h-screen bg-[#141414]">
      {/* Hero Section */}
      <div
        className="relative h-[85vh] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroBackground})` }}
      >
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent"></div>

        {/* Hero Content */}
        <div className="relative z-10 h-full flex flex-col justify-center px-8 lg:px-16 max-w-2xl"></div>
      </div>

      {/* Featured Section */}
      <div className="px-8 lg:px-16 py-10 -mt-20 relative z-20"></div>
    </div>
  );
};

export default HomePage;
