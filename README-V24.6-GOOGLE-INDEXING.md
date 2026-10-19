# DEASJobs v24.6 Google Indexing Fix

This release addresses Google Search Console classifying the DEASJobs home page as a Soft 404.

Changes:
- Adds substantial crawlable home-page content to the initial HTML.
- Keeps meaningful DEASJobs/job content in the rendered unauthenticated page.
- Adds canonical, robots, Open Graph and WebSite/Organization structured data to the home page.
- Adds the root URL to sitemap.xml.
- Explicitly allows the root URL in robots.txt.
- Makes /jobs useful and descriptive even when there are temporarily no public jobs.
- Does not change D1.

After deployment, test https://deasjobs.com/ in Google Search Console URL Inspection > Test live URL. If the live test changes from Soft 404 to indexable, click Request indexing. Submit https://deasjobs.com/sitemap.xml under Sitemaps if it has not already been submitted.
