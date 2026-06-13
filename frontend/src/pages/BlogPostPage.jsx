import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api';
import SiteHeader from '../components/site/SiteHeader';
import SiteFooter from '../components/site/SiteFooter';
import CmsEmpty from '../components/site/CmsEmpty';
import './HomePage.css';
import './Content.css';

const BlogPostPage = () => {
    const { slug } = useParams();
    const { t, i18n } = useTranslation();
    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`blog/${slug}/?lang=${i18n.language}`)
            .then((r) => setPost(r.data))
            .catch(() => setPost(null))
            .finally(() => setLoading(false));
    }, [slug, i18n.language]);

    return (
        <div className="lpc cms-page">
            <SiteHeader />
            <main className="cms-main">
                {loading ? (
                    <p className="cms-loading">{t('common.loading')}</p>
                ) : post ? (
                    <article className="wrap-narrow">
                        <Link to="/blog" className="blog-back">← {t('home.blog_title')}</Link>
                        <h1 className="cms-title">{post.title}</h1>
                        <div className="blog-meta">{new Date(post.published_at).toLocaleDateString()}</div>
                        {post.cover && <img className="blog-cover" src={post.cover} alt={post.title} />}
                        <div className="info-content" dangerouslySetInnerHTML={{ __html: post.body }} />
                    </article>
                ) : (
                    <CmsEmpty icon="📰" />
                )}
            </main>
            <SiteFooter />
        </div>
    );
};

export default BlogPostPage;
