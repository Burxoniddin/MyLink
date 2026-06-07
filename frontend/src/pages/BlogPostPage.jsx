import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api';
import LanguageSwitcher from '../components/LanguageSwitcher';
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
        <div className="blog-page">
            <div className="blog-bar">
                <Link to="/blog" className="info-brand">← {t('home.blog_title')}</Link>
                <LanguageSwitcher />
            </div>
            {loading ? (
                <p>{t('common.loading')}</p>
            ) : post ? (
                <>
                    <h1>{post.title}</h1>
                    <div className="blog-meta">{new Date(post.published_at).toLocaleDateString()}</div>
                    {post.cover && <img className="blog-cover" src={post.cover} alt={post.title} />}
                    <div className="info-content" dangerouslySetInnerHTML={{ __html: post.body }} />
                </>
            ) : (
                <p>{t('landing.not_found_title')}</p>
            )}
        </div>
    );
};

export default BlogPostPage;
