import { z } from "zod";
export const aiSettingsSchema = z
  .object({
    key: z.string().trim().max(2048),
    baseURL: z.string().trim().max(500),
    model: z.string().trim().min(1).max(120),
  })
  .superRefine((value, ctx) => {
    try {
      const url = new URL(value.baseURL);
      const allowed =
        [
          "dashscope.aliyuncs.com",
          "dashscope-intl.aliyuncs.com",
          "dashscope-us.aliyuncs.com",
        ].includes(url.hostname) ||
        /^[a-z0-9-]+\.(cn-beijing|cn-shanghai|ap-southeast-1|us-east-1)\.maas\.aliyuncs\.com$/.test(
          url.hostname,
        );
      if (
        url.protocol !== "https:" ||
        !allowed ||
        url.port ||
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !/^\/compatible-mode\/v1\/?$/.test(url.pathname)
      )
        throw Error();
    } catch {
      ctx.addIssue({
        code: "custom",
        message: "请填写百炼官方兼容接口基址，以 /compatible-mode/v1 结尾。",
        path: ["baseURL"],
      });
    }
  });
export type AISettingsInput = z.infer<typeof aiSettingsSchema>;
export type AISettingsView = {
  enabled: boolean;
  hasKey: boolean;
  baseURL: string;
  model: string;
  running: boolean;
  notice?: string;
};
