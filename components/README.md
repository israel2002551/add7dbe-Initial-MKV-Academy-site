# Components — Reference Markup

These files are **static reference snippets** showing the exact markup each
component produces. They are handy for designers/devs browsing the repo,
but they are not wired up with <script>/fetch() on their own.

The live, functional versions of these components are template functions in
../js/components.js (navbar, footer) and ../js/courses.js,
../js/testimonials.js (cards), injected directly into each page at
runtime. This avoids fetch()-ing local HTML fragments, which browsers
block via CORS when a page is opened directly from disk (no server).

To edit a component: change the corresponding function in js/components.js,
js/courses.js, or js/testimonials.js — not these reference files.

If you later deploy behind a real web server (Node/Nginx/Netlify/etc.) and
want true server-included partials instead, these snippets are your
starting point for fetch()-based includes.
