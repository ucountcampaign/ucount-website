import { handle } from "@astrojs/cloudflare/handler";
import { guardRequestPath } from "./lib/request-guard";

export default {
  fetch(...args: Parameters<typeof handle>) {
    return guardRequestPath(new URL(args[0].url)) ?? handle(...args);
  },
};
