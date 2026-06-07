import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api';
import LanguageSwitcher from '../components/LanguageSwitcher';
import './Content.css';

const Blog = () => {
    const { t, i18n } = useTranslation();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`blog/?lang=${i18n.language}`)
            .then((r) => setPosts(r.data))
            .catch(() => setPosts([]))
            .finally(() => setLoading(false));
    }, [i18n.language]);

    return (
        <div className="blog-page">
            <div className="blog-bar">
                <Link to="/" className="info-brand">← MyLink</Link>
                <LanguageSwitcher />
            </div>
            <h1>{t('home.blog_title')}</h1>
            {loading ? (
                <p>{t('common.loading')}</p>
            ) : posts.length === 0 ? (
                <p>{t('home.blog_empty')}</p>
            ) : (
                <div className="blog-list">
                    {posts.map((p) => (
                        <Link key={p.slug} to={`/blog/${p.slug}`} className="blog-card">
                            {p.cover && <img src={p.cover} alt={p.title} />}
                            <div className="bc-body">
                                <h3>{p.title}</h3>
                                {p.excerpt && <p>{p.excerpt}</p>}
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Blog;
