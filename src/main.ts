import { seedManager } from "./modules/app/SeedManager.ts";

const result = await seedManager.update();
console.log("Returned", result);
