Project Overview: EVE Market Data Integration (Adam4EVE)

Objectives and Scope
The goal of this project is to integrate EVE Online market data from the Adam4EVE platform into a new application. This involves importing the market data (e.g. large market order trades, aggregated weekly) and building a system to store, query, and possibly visualize or analyze that data. Ultimately, the application should allow us to observe trends or insights from EVE Online’s market over time using the Adam4EVE data. The focus is on data integration and analysis, rather than building unrelated features.

Key goals:
Data Import: Retrieve or import historical market trade data (provided by Adam4EVE) into our own database.
Data Storage: Design a database (via Prisma ORM) to store this data in an organized way (ensuring we capture all relevant fields from the Adam4EVE dataset).
Data Usage: Implement functionalities to use this data – for example, generating charts, running queries to find trends, or exposing an API for specific queries. The exact usage can include visualizing weekly trade volumes or analyzing patterns.
Maintainability: Set up the project structure so it’s easy to update with new data or add features (like additional datasets or analyses) in the future.
Data Source: Adam4EVE Market Data
Adam4EVE is a third-party website that provides extensive graphs and statistics for the EVE Online in-game market
forums.eveonline.com
. All data it provides is derived from EVE’s publicly available market information (no private APIs or keys required)
forums.eveonline.com
. Specifically, Adam4EVE offers metrics like price trends, trade volumes, market hub statistics, etc., aggregated from EVE’s economy. For this project, the relevant data from Adam4EVE is the “market order trades” on a weekly basis (possibly spanning the years 2025–2030, based on the provided CSV file name). This dataset likely contains the total number of items traded (or a similar aggregate metric) per week. It might distinguish between different types of trades (for example, how many items were bought vs. sold in the market each week) or could be a single aggregate value per week.
The data is provided in a CSV file (marketOrderTrades_weekly_2025-30.csv), which presumably includes columns such as a week identifier (or date) and one or more metrics (e.g. total trade count, trade volume, etc. for that week).
We should confirm the exact columns and format of this CSV. For instance, it might have columns like week_start_date, total_trades, buys_from_sell_orders, sells_to_buy_orders, etc., based on how Adam4EVE structures its data (Adam4EVE often distinguishes buys vs sells in its metrics). If it’s a simple time series of total trades per week, it might just have a date and a value.
Understanding the data will guide our database schema. Initially, we’ll assume the data represents an overall weekly trade volume/count in EVE’s economy (potentially global or for a specific region if noted). If the data is segmented (e.g., by region or item type), we’ll need to account for that in the schema (e.g., include a region or item column). But since only one CSV is mentioned, we can start simple with the assumption of a single aggregated series (and extend later if needed).
Tech Stack & Progress So Far
The project is set up with a modern JavaScript/TypeScript stack, likely using Node.js and possibly a framework like Next.js for the application (since Next.js is commonly used and was likely set up initially). Key technologies include:
Prisma ORM: for database modeling and access. This has already been initialized. (You’ve completed the Prisma initialization step, which means a Prisma schema file exists and the connection to a database is configured.)
Database: A database has been set up via Prisma. By default, this might be a SQLite database (if using the default in development), or it could be Postgres/MySQL depending on your configuration in schema.prisma and .env. Since Prisma is initialized, the next step is to define data models (tables) in the Prisma schema.
Frontend Framework: If Next.js or a similar framework was indeed set up in earlier steps (as is likely in a full-stack project), it means we have a basic project structure to build UI components for data visualization or user interface. (If not Next.js, it could be an Express API with no front-end yet, but given the context we assume a Next.js app for ease of building both API routes and pages.)
Other Libraries: Possibly UI libraries (for example, Tailwind CSS for styling, chart libraries for visualization) if they were part of initial setup. (Your mention of completing steps until Prisma init suggests earlier steps may have included setting up a Next.js app and adding Tailwind or similar, if that was part of the plan.)
Progress accomplished so far:
Project Initialization: The project scaffold is created (likely a Next.js app or Node project). The development environment is configured (package.json, necessary scripts, etc.).
Dependencies Installed: Required libraries have been added. This includes Prisma for ORM, and possibly any other packages needed (e.g. CSV parsing library, front-end frameworks or charting libraries if identified early).
Prisma Setup: Prisma has been initialized (npx prisma init was run). We have a schema.prisma file and a working database connection (for example, a connection string in the .env file). No models/tables have been defined yet beyond the default.
(If applicable) Basic Frontend Setup: If this is a Next.js app, we might have a basic homepage or structure in place and Tailwind CSS configured, based on typical project setup steps. (This was not explicitly mentioned, but often part of initial steps.)
With Prisma initialized, we haven’t run migrations or created any tables yet – that is the next crucial step. The user has confirmed up to this point (environment and Prisma init) is complete.
Database Schema Design (Prisma Models)
Now we need to design the database schema to store the Adam4EVE market data. The first and most important table will be one that holds the weekly market trade data from Adam4EVE, which we discussed earlier but haven’t implemented yet. It’s crucial we create this table (model) to reflect the structure of the data in the CSV:
We’ll create a Prisma model (which will translate to a database table) for the Adam4EVE trade records. Let’s call it something like MarketTrade or WeeklyTradeData (the exact name can be decided for clarity).
Fields for MarketTrade model: At minimum, this table needs:
An ID field (primary key). Prisma can use id Int @id @default(autoincrement()) or similar for this.
A date or week identifier field. Perhaps the data is weekly, so a date representing the week (e.g. the starting date of the week or week number and year). We might use a Date field (JavaScript Date type) for the week start or end. Alternatively, we could store year and week number as separate fields, but a single date (say Monday of each week) might be simplest.
Trade volume/count field(s). This could be a single numeric field if the CSV just has one metric (e.g. total number of trades that week). We need to determine from the CSV if it’s count of trades or total volume of items traded. The name could be tradeCount (if it’s count of trades) or tradeVolume (if it’s volume of items/ISK).
If the data distinguishes buys vs sells (as Adam4EVE often does), we might have two fields: e.g. buyVolume and sellVolume or buys_count and sells_count. These would represent how much was bought from sell orders vs sold to buy orders in that week
forums.eveonline.com
. This is optional and only if the dataset provides that breakdown.
If the data is specific to a region or market hub (for example, only for the Forge region, or only Jita market), we should include a field for region or location. However, if the CSV represents the entire game (“New Eden” as a whole), we might not need a region field. We should verify if the dataset is global or region-specific. (If later we plan to handle multiple regions or items, we could add fields or have a separate table for regions/items and reference it.)
Any other fields from the CSV: sometimes data might include additional info like an ISK value or an item category. We should inspect the CSV to be sure we capture everything. The general approach is to have one column in the table per column in the CSV (besides the ID we add).
Example Prisma model (in a conceptual sense):
prisma
Copy
Edit
model MarketTrade {
id Int @id @default(autoincrement())
weekDate DateTime // e.g. date representing the week
totalTrades Int // total trades in that week (or a BigInt if extremely large)
buysFromSellOrders Int? // optional: if data has this
sellsToBuyOrders Int? // optional: if data has this
// ... any other fields as needed
}
(The above is just an illustrative example; the actual fields depend on the CSV content.)
Since the user explicitly wanted a table for the Adam4EVE data, this model addresses that. This was a key requirement previously discussed: we need to ensure the Adam4EVE data is stored properly, rather than focusing on other tables that aren’t needed yet. At this stage, we likely do not need other tables (like users, etc.), because our app’s primary purpose for now is just handling the market data. We can always extend the schema later if the scope grows (for example, if we introduce data for multiple items or add user accounts for a web interface), but those are out of scope for now.
After defining the MarketTrade model in schema.prisma, we will run a Prisma migration (e.g. npx prisma migrate dev --name add_market_trade_table) to create the actual table in the database. This will update our SQLite (or Postgres) with a new table for the data.
In summary, the database design centers around a single table for market trades data at this point. Keeping it simple is ideal: it aligns with current needs and avoids over-engineering. We ensure this table captures all needed information from the Adam4EVE dataset.
Data Import Strategy
Once the database table is ready, the next step is to populate it with the Adam4EVE data from the CSV file (marketOrderTrades_weekly_2025-30.csv). Here’s the plan for importing the data:
Verify Data Format: First, confirm the CSV’s structure (columns and data types). For example, open the CSV to see if it has a header row, what the column names are, and sample values. This will confirm what fields to parse (e.g., does it have a column for week date, and a column for trade count? Does it have multiple columns for different trade types?). This step ensures our database fields match the CSV columns.
Write Import Script: We will create a script or use a tool to read the CSV and insert records into the database:
One approach is to write a Node.js script (could be a standalone script or part of Next.js API route) that uses Prisma Client to create entries. For instance, using Node’s file system or a CSV parsing library to read each line, then for each row call prisma.marketTrade.create({ data: { ... } }) with the parsed values.
Prisma has a seeding mechanism as well. We can configure Prisma to run a seed script (for example, using prisma/seed.ts that reads the file and populates the DB) and run npx prisma db seed. This would be a convenient way to load initial data.
We should be mindful of performance if the CSV is very large (though weekly data for a ~5-year range shouldn’t be too huge). We can batch inserts if needed or simply iterate if performance is acceptable.
Data Cleaning: As we import, ensure the data types align. For example, if the CSV has numeric values possibly in string form, convert them to numbers. If dates are in string format (like "2025-01-01"), convert to proper Date objects or ISO strings for the database.
Run the Import: Execute the script to insert all records. After running, verify that the table now contains the expected number of rows (e.g., if 6 years of weekly data ~ 312 weeks, we should have ~312 entries, assuming one per week, or more if multiple entries per week for different categories).
Verification: Query the database (via Prisma or a DB client) to spot-check a few entries against the CSV to ensure data integrity. This step catches any misalignment (e.g., off-by-one errors, or if any fields didn’t parse correctly).
By the end of this step, we should have our Adam4EVE market data successfully stored in our database, ready to be used by the application.
Utilizing the Data (Queries & Features)
With data in place, the next part is building out features to make use of this information. Depending on the project’s aim, this typically involves:
Backend Queries or API: We can create API endpoints (if using Next.js, Next API routes, or if not, perhaps a small Express server) to fetch data from the database. For instance, an endpoint like /api/trades?start=2025-01-01&end=2026-01-01 could return the trade data between given dates. Or an endpoint /api/trades/latest to get the most recent week’s data. This will allow a frontend component to get the data via HTTP requests if needed.
If the app is primarily server-rendered or uses React server components (in Next.js 13+), we might also query the database directly in the page code (using Prisma in getServerSideProps or similar) rather than exposing a separate API. The approach will depend on how the front-end is structured.
Data Visualization/UI: A likely next step is to present the data visually. We might create a chart showing the weekly trade volumes over time:
For example, use a chart library (like Chart.js, D3, or Recharts) to plot Week on the X-axis and Trade Volume on the Y-axis. This would quickly show trends (rising, falling, seasonal patterns, etc.).
A table or summary can complement the chart, showing exact values for certain weeks or highlighting the highest/lowest trade weeks.
If multiple metrics are present (buy vs sell), we could use a dual chart or two lines on the same chart to compare them.
Interactive Analysis: Possibly provide controls for the user (yourself or others) to filter or adjust the view:
For instance, if data spans 2025–2030, allow selecting a subset (like 2025-2027) to zoom in.
If data can be broken down by region or item (in case we add such dimensions later), allow filtering by region or item type.
Derived Insights: We could also compute some derived metrics:
Calculate moving averages (to smooth out volatility and show trend lines).
Identify peak trade weeks or anomalies (e.g., a sudden spike in trades – which might correlate with a game event or update).
If the data is forecasted into the future (up to 2030 might imply projections), we could highlight forecast vs actual (though that’s speculative unless we know the data source).
All these features would be built on top of the data now stored in the database. The immediate tasks for utilizing data would be to create whatever the project requires to make the data accessible:
If a front-end is in place, integrate Prisma queries or API calls into the pages/components to display the info.
Ensure the data updates in the UI when the database updates (if we plan to import new data later or live update).
Possibly include error handling (e.g., if no data is available for a given range, or if database connection fails, etc.).
Since the user’s current need is primarily the data integration, the initial feature can be as simple as displaying a static chart of the entire dataset. This would prove that everything works end-to-end (data in DB → fetched → displayed). From there, one can iteratively add more polish (like interactivity, nicer UI, etc.).
Next Steps and Task Breakdown
To summarize the big picture plan, here’s a breakdown of tasks (some completed, some upcoming):
Project Setup (Completed): Initialize project and tools (Next.js app or similar, set up Node environment, etc.). Confirmed that Prisma is installed and configured.
Prisma Schema Design (In Progress): Define the MarketTrade model in schema.prisma to represent Adam4EVE weekly trade data. Include fields for all relevant data from the CSV (date, trade counts, etc.). (This addresses the earlier oversight: we must not ignore the need for this table, as it’s central to the project.)
Database Migration: Run Prisma migrate to apply the new schema and create the MarketTrade table in the database.
Data Import: Write and execute a script to load the CSV data into the MarketTrade table.
This includes parsing the CSV and creating records via Prisma.
Verify that the data in the DB matches the CSV source.
Feature Development:
Back-end: Implement any necessary API endpoints or direct database query functions to retrieve the data. For example, a function to get all trades in chronological order from the DB.
Front-end: Create components or pages to display data. Start with a simple visualization (line chart of trades over time) or even just a list of data points to ensure everything is connected.
Ensure that the front-end can request data from the back-end (if using an API) or directly fetch it server-side.
Refinement: Enhance the presentation and analysis:
Improve the chart or table formatting, add labels, etc.
If needed, implement filtering (by date range, etc.) or additional analytics (like showing average per year, growth rates, etc.).
Respond to any new requirements or insights – for instance, if you want to compare multiple datasets or include additional data from Adam4EVE (we could later add more tables, e.g., price data or other metrics, but only if needed).
Testing: Throughout, test each part:
Ensure the migration and seeding (data import) can be repeated reliably on a fresh database.
Test that the data displayed on the UI matches the database values.
Handle edge cases (e.g., what happens if the database is empty or if there are gaps in data).
Future Considerations (beyond initial scope):
Automating data updates: If Adam4EVE or CCP releases new data beyond what’s in the CSV, we might want to fetch new data periodically and update the database. This could involve writing a small cron job or on-demand fetch from an API (if available). Adam4EVE itself might not provide an official API, but CCP’s ESI could provide raw market data that one could aggregate similarly. This is an advanced task for later.
Additional datasets: We could integrate other related data (e.g., price indices, money supply, etc., some of which Adam4EVE and CCP’s reports provide) to correlate with the trade volume data. Again, only if it serves the project’s goal.
Deployment: Eventually, if this is to be a live app, consider deploying the app (and possibly using a cloud database). Prisma can easily switch to a production database when needed.
Non-goals for now: features like user accounts, authentication, or any unrelated functionalities are not in scope, keeping the project focused and manageable.
Conclusion
In summary, the project is focused on building a data-driven application using EVE Online market data from Adam4EVE. We have set up the development environment and Prisma, and the next critical steps are to design the right database table for the data and import that data correctly. From there, we will create ways to query and visualize the information. By following this plan, we ensure we don’t skip the essential step of structuring and storing the Adam4EVE data (which was identified as a need early on). Each step has been outlined so it can be tackled one by one, and this “big picture” should serve as a roadmap moving forward.
