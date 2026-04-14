# Design System Generator AI

A powerful, high-fidelity Figma plugin intelligence designed to seamlessly bootstrap professional-grade design systems with a single click.

## Core Features

- **Intelligent Semantic Color Engine**: Input a base semantic HEX (Primary, Secondary, Success, Info, Warning, Danger, Gray) and let the engine construct perfectly contrasting 50–900 tint and shade scales automatically via precise HSL interpolation logic.
- **True Neutral Generation**: By default, the plugin securely provisions `Neutral/Black` (#000000) and `Neutral/White` (#FFFFFF) absolute variables for root-level design operations, totally independently of colored greys.
- **Advanced Dynamic Font Explorer**: Powered by Figma's backend, the plugin immediately fetches *all* typefaces available on your personal machine and Figma's external cloud library. It renders them inside a lightning-fast, custom-built 100% scrollable floating UI layout featuring real-time "filter-as-you-type" search functionality. 
- **Automated Typography Hierarchy**: Utilizing your chosen typeface, it intelligently constructs responsive, standardized web typography trees (Display, Heading, Body scale) perfectly weighted for immediate deployment.
- **Figma Local Variables & Paint Styles**: Instead of loose hex codes, everything is injected deeply into Figma's newest Variable system architecture (`Design System -> COLOR`) and natively published into legacy Local Styles for older plugin compatibility syncing.
- **Spacing Grid System**: Automatically injects standard Float variables matching robust 4pt/8pt box-model scaling principles (from 0px up to 96px).
- **Smart Matrix Deduplication**: Safe overwrite logic! When you run the generator numerous times to tweak palettes, it natively detects your existing tokens and forcefully updates their values in place, rather than duplicating thousands of random styles.
- **Starter Plan Constraint Evasion**: For users developing on Figma's Free Tier, it automatically intercepts restrictive "max 3-page" API lockouts and gracefully dumps local tokens down onto your current view. 

## How To Run Locally
1. Run `npm install` inside the project root directory once to fetch typing dependencies.
2. Ensure you have activated the typescript compiler using `npm run build` or `npm run watch`.
3. Open a Figma Document.
4. Navigate to `Plugins` -> `Development` -> `Import plugin from manifest...`
5. Select the `manifest.json` embedded in this folder.
6. Enjoy intelligent local design system architecture!
