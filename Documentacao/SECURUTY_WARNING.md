Important Security Information Regarding React & Next.js Vulnerability (CVE-2025-55182)
06/12/2025 20:39
This communication is being distributed to all Google Cloud customers and is not intended as an affirmation of a predetermined risk to your specific application deployment. Continue to check our blog for the latest updates on defenses. 

Dear Google Cloud customer,

We are writing to inform you about a critical remote code execution (RCE) vulnerability, CVE-2025-55182, found in the open-source React and Next.js frameworks. This vulnerability impacts React Server Components and may affect your applications deployed on Google Cloud (Cloud Run, Cloud Run functions, App Engine, Kubernetes Engine, Compute Engine, Firebase) if they include vulnerable versions of these frameworks.

While Google Cloud itself is not impacted, the applications you deploy may be vulnerable if they depend on the affected React and Next.js packages. 

Given that this vulnerability now has published exploits, it is critical that you take the following steps to secure your environment.

Vulnerable Versions Include:
React 19.0, 19.1.0, 19.1.1, and 19.2.0

Next.js 15.x, Next.js 16.x, Next.js 14.3.0-canary.77 and later canary releases

What to do:
Update Dependencies: The most important action is to review your applications for use of React and Next.js and update your application dependencies to the latest stable, patched versions (React 19.2.1 or the relevant Next.js versions) and redeploy your applications immediately.

Utilize Cloud Armor:

If your application is behind a Google Cloud Application Load Balancer, you can configure Cloud Armor with the new cve-canary WAF rule to help detect and block exploitation attempts, which was last updated on Friday, Dec 5 at Noon PT. Detailed instructions are in our blog post.

If your application directly receives traffic from the internet, you must first set up an Application Load Balancer in front of your service to leverage Cloud Armor.

Note: While Cloud Armor provides an additional layer of defense, updating the underlying frameworks is the most comprehensive long-term solution. We recommend testing the WAF rule in preview mode first, as its impact on legitimate traffic is unknown.

Further Information:
We will continue to update these resources as additional information is available.

Security Bulletin: GCP-2025-072

Blog Post: Responding to CVE-2025-55182: Secure your React and Next.js workloads

We're here to help
We appreciate your business and apologize for any inconvenience this may have caused. If you have any questions or require assistance, please contact Google Cloud Support and reference issue number 465748820.

Sincerely, 

Google Cloud Support

Reference: 465748820