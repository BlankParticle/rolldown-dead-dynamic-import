import { flag } from "./flag.js";

if (flag) {
    console.log("Deploying")
    import("./deploy.js");
} else {
    console.log("Not Deploying")
}