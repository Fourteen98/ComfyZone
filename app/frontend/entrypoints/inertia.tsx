import { createInertiaApp } from '@inertiajs/react'

// This file is the front door of the React side. The Rails layout loads it on
// every page (see app/views/layouts/application.html.erb).
//
// When a controller does `render inertia: "Dashboard"`, Rails puts a
// <div id="app"> on the page along with the component name and props.
// createInertiaApp reads that, finds app/frontend/pages/Dashboard.tsx,
// and renders it.
//
// Classic ERB pages (the password reset screens) have no #app element,
// so there is nothing for React to do on them.
if (document.getElementById('app')) {
  void createInertiaApp({
    // Where page components live. "Sessions/New" -> pages/Sessions/New.tsx
    pages: '../pages',
    strictMode: true,
    defaults: {
      form: {
        forceIndicesArrayFormatInFormData: false,
        // Rails gives a list of errors per field; keep all of them.
        withAllErrors: true,
      },
      // Send arrays in query strings the way Rails expects: ids[]=1&ids[]=2
      visitOptions: () => ({ queryStringArrayFormat: 'brackets' }),
    },
  })
}
