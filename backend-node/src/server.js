import app from "./app.js";
import { syncProductionIndex } from "./modules/discovery/search.service.js";

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  syncProductionIndex().then((count) => console.log(`Search index ready (${count} productions)`));
});
