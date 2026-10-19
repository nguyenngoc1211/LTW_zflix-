import app from "./app.js";
import { syncProductionIndex } from "./modules/discovery/search.service.js";

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  syncProductionIndex().then((count) => console.log(`Search index ready (${count} productions)`));
});
