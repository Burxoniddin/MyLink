import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api';
import SiteHeader from '../components/site/SiteHeader';
import SiteFooter from '../components/site/SiteFooter';
import CmsEmpty from '../components/site/CmsEmpty';
import './HomePage.css';
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
        <div className="lpc cms-page">
            <SiteHeader />
            <main className="cms-main">
                {loading ? (
                    <p className="cms-loading">{t('common.loading')}</p>
                ) : posts.length === 0 ? (
                    <CmsEmpty icon="📰" />
                ) : (
                    <div className="wrap-narrow">
                        <h1 className="cms-title">{t('home.blog_title')}</h1>
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
                    </div>
                )}
            </main>
            <SiteFooter />
        </div>
    );
};

export default Blog;
