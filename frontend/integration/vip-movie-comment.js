import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthContext } from '../src/context/auth-context.js';
import MovieCommentItem from '../src/components/streamingPage/MovieCommentItem.jsx';
import '../src/index.css';

const comment = { id: 501, user_id: 11, username: 'movie_vip', avatar_url: null,
  vip_expires_at: new Date(Date.now() + 86400000).toISOString(), content: 'Bình luận phim VIP',
  status: 'active', reply_count: 1, created_at: new Date().toISOString() };
createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter, null,
  React.createElement(AuthContext.Provider, { value: { user: { id: 10, role: 'user' } } },
    React.createElement(MovieCommentItem, { comment, productionId: 2147482400 }))));
