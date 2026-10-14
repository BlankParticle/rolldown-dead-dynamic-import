import { deploy } from "./deploy.js";

if (globalThis.DEPLOY) {
    console.log("Deploying")
    deploy()
} else {
    console.log("Not Deploying")
}