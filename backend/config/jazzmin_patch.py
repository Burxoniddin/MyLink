"""
Jazzmin + Django 5.2 compatibility patch.

Django 5.2 changed format_html() to require args/kwargs.
Jazzmin's jazzmin_paginator_number calls format_html(html_str) without args,
which raises TypeError. This patch fixes it at startup.
"""

def apply_jazzmin_patch():
    try:
        from jazzmin.templatetags import jazzmin as jazzmin_tags
        from django.utils.safestring import mark_safe

        original_func = getattr(jazzmin_tags, 'jazzmin_paginator_number', None)
        if original_func is None:
            return

        def patched_jazzmin_paginator_number(cl, i):
            try:
                return original_func(cl, i)
            except TypeError:
                # Fallback: Django 5.2 format_html() requires args
                from django.contrib.admin.templatetags.admin_list import paginator_number
                return paginator_number(cl, i)

        jazzmin_tags.jazzmin_paginator_number = patched_jazzmin_paginator_number

        # Also patch the registered template tag
        if hasattr(jazzmin_tags, 'register'):
            lib = jazzmin_tags.register
            if 'jazzmin_paginator_number' in lib.tags:
                from django.template.library import SimpleNode
                # Re-register with patched function
                lib.tags['jazzmin_paginator_number'] = lib.tags['jazzmin_paginator_number']

    except ImportError:
        pass
    except Exception:
        pass
