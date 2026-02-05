=== BMGF Calculus Market Dashboard ===
Contributors: partnerinpublishing
Tags: dashboard, analytics, education, calculus, market analysis
Requires at least: 5.0
Tested up to: 6.4
Stable tag: 1.0.0
Requires PHP: 7.4
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Interactive dashboard for Math Education Market Analysis - Calculus textbook market data visualization.

== Description ==

BMGF Calculus Market Dashboard provides an interactive visualization of calculus textbook market data across US educational institutions.

Features:
* Interactive map showing enrollment data by state
* Calculus I and II distribution charts
* Institution analysis
* Textbook market analysis
* Publisher comparison data

== Installation ==

1. Upload the `bmgf-calculus-dashboard` folder to the `/wp-content/plugins/` directory
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Go to Settings > Permalinks and click "Save Changes" to flush rewrite rules
4. Use the shortcode `[bmgf_dashboard]` on any page or post

== Usage ==

**Basic Usage:**
Add the shortcode to any page or post:
`[bmgf_dashboard]`

**With Custom Height:**
`[bmgf_dashboard height="2000px"]`

**Show Specific Tab:**
`[bmgf_dashboard page="enrollment"]`
`[bmgf_dashboard page="institutions"]`
`[bmgf_dashboard page="textbooks"]`

**Full Page Template:**
`[bmgf_dashboard_page]`

== Frequently Asked Questions ==

= The charts don't load correctly =

Make sure to visit Settings > Permalinks and click "Save Changes" after activating the plugin. This flushes the rewrite rules needed for the chart files.

= Can I customize the dashboard appearance? =

Yes, you can add custom CSS to your theme to override the default styles. All elements use the `bmgf-` prefix for their CSS classes.

== Changelog ==

= 1.0.0 =
* Initial release

== Upgrade Notice ==

= 1.0.0 =
Initial release of BMGF Calculus Market Dashboard.
