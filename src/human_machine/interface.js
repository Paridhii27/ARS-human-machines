import * as fal from "npm:@fal-ai/serverless-client";
import { loadEnv } from "../shared/util.ts";
import * as log from "../shared/logger.ts";

import { Application, Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { gptPrompt } from "../shared/openai.ts";
import { makeImage } from "../shared/openai.ts";
import { createExitSignal, staticServer } from "../shared/server.ts";

import { Chalk } from "npm:chalk@5";

// tell the shared library code to log as much as possible
log.setLogLevel(log.LogLevel.DEBUG);

// Change the current working directory to the directory of this script
// This is necessary to serve static files with the correct path even
// when the script is executed from a different directory
Deno.chdir(new URL(".", import.meta.url).pathname);
// log the current working directory with friendly message
console.log(`Current working directory: ${Deno.cwd()}`);

const env = loadEnv();
if (!env.FAL_API_KEY) log.warn("No FAL_API_KEY in .env file");

fal.config({
  credentials: env.FAL_API_KEY, // or a$function that returns a string
});

const chalk = new Chalk({ level: 1 });

// create web server
const app = new Application();
const router = new Router();

router.get("/api/gpt", async (ctx) => {
  const prompt = ctx.request.url.searchParams.get("prompt"); // Access query parameter using ctx.request
  console.log("Request received");
  console.log(prompt);

  const machineAnalysis = `Based on the ${prompt}. List factors on how the chosen machine's interface can be made more intuitive to human behaviour in accordance to the suggested feature such as sustainability, adaptability, emotional intelligence etc..`;
  const result = await gptPrompt(machineAnalysis, { temperature: 0.7 });
  ctx.response.body = result;
});

// add the DALL•E route
router.get("/api/dalle", async (ctx) => {
  const prompt = ctx.request.url.searchParams.get("prompt");
  console.log("Request received");
  console.log(prompt);
  const shortPrompt = prompt.slice(0, 1024);
  const result = await makeImage(shortPrompt);
  ctx.response.body = result;
});

router.get("/api/fal", async (ctx) => {
  const prompt = ctx.request.url.searchParams.get("prompt");
  console.log("Request received");
  console.log(prompt);
  const shortPrompt = prompt.slice(0, 1024);
  const result = await fal.subscribe("fal-ai/stable-cascade", {
    input: {
      prompt: shortPrompt,
      negative_prompt: "",
      first_stage_steps: 20,
      second_stage_steps: 10,
      guidance_scale: 4,
      image_size: "square_hd",
      num_images: 1,
      loras: [],
      enable_safety_checker: true,
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS") {
        // update.logs.map((log) => log.message).forEach(console.log);
      }
    },
  });
  console.log("result", result);
  ctx.response.body = result.images[0].url;
});

router.get("/api/falfast", async (ctx) => {
  const prompt = ctx.request.url.searchParams.get("prompt");
  console.log("Request received");
  console.log(prompt);
  const shortPrompt = prompt.slice(0, 1024);
  const result = await fal.subscribe("fal-ai/fast-lightning-sdxl", {
    input: {
      prompt: shortPrompt,
      image_size: "square_hd",
      num_inference_steps: "4",
      num_images: 1,
      enable_safety_checker: true,
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS") {
        // update.logs.map((log) => log.message).forEach(console.log);
      }
    },
  });
  console.log("result", result);
  ctx.response.body = result.images[0].url;
});

// install routes
app.use(router.routes());
app.use(router.allowedMethods());

// set it up to serve static files from public
app.use(staticServer);

// tell the user we are about to start
console.log(chalk.green("\nListening on http://localhost:2000"));

// start the web server
await app.listen({ port: 2000, signal: createExitSignal() });
