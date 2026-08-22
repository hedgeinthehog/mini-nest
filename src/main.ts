import { createApp } from "./server.js";

const server = createApp();

server.listen(3000, () => console.log("Server is running on port 3000"));