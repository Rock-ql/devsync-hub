package com.devsync.client;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONObject;
import com.devsync.common.exception.BusinessException;
import com.devsync.service.ISystemSettingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

/**
 * DeepSeek AI 客户端
 *
 * @author xiaolei
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DeepSeekClient {

    private final ISystemSettingService systemSettingService;
    private final OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectTimeout(60000, TimeUnit.MILLISECONDS)
            .readTimeout(60000, TimeUnit.MILLISECONDS)
            .writeTimeout(60000, TimeUnit.MILLISECONDS)
            .build();

    @Value("${devsync.deepseek.model:deepseek-chat}")
    private String model;

    /**
     * 获取API Key（从数据库）
     */
    private String getApiKey() {
        return systemSettingService.getSetting("deepseek.api.key");
    }

    /**
     * 获取Base URL（从数据库）
     */
    private String getBaseUrl() {
        String url = systemSettingService.getSetting("deepseek.base.url");
        return url != null && !url.isEmpty() ? url : "https://api.deepseek.com";
    }

    /**
     * 调用DeepSeek生成内容
     *
     * @param systemPrompt 系统提示词
     * @param userPrompt   用户提示词
     * @return 生成的内容
     */
    public String chat(String systemPrompt, String userPrompt) {
        log.info("[DeepSeek客户端] 调用AI生成，系统提示词长度: {}, 用户提示词长度: {}",
                systemPrompt.length(), userPrompt.length());
        log.info("[DeepSeek客户端] 系统提示词全文开始\n{}\n[DeepSeek客户端] 系统提示词全文结束", systemPrompt);
        log.info("[DeepSeek客户端] 用户提示词全文开始\n{}\n[DeepSeek客户端] 用户提示词全文结束", userPrompt);

        String apiKey = getApiKey();
        String baseUrl = getBaseUrl();

        if (apiKey == null || apiKey.isEmpty()) {
            throw new BusinessException(500, "DeepSeek API Key未配置");
        }

        log.info("[DeepSeek客户端] 使用Base URL: {}", baseUrl);

        // 构建请求体
        JSONObject requestBody = new JSONObject();
        requestBody.put("model", model);
        requestBody.put("max_tokens", 4096);
        requestBody.put("temperature", 0.7);

        JSONArray messages = new JSONArray();

        // 系统消息
        JSONObject systemMessage = new JSONObject();
        systemMessage.put("role", "system");
        systemMessage.put("content", systemPrompt);
        messages.add(systemMessage);

        // 用户消息
        JSONObject userMessage = new JSONObject();
        userMessage.put("role", "user");
        userMessage.put("content", userPrompt);
        messages.add(userMessage);

        requestBody.put("messages", messages);

        RequestBody body = RequestBody.create(
                requestBody.toJSONString(),
                MediaType.parse("application/json")
        );

        Request request = new Request.Builder()
                .url(baseUrl + "/v1/chat/completions")
                .header("Authorization", "Bearer " + apiKey)
                .header("Content-Type", "application/json")
                .post(body)
                .build();

        try (Response response = httpClient.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                String errorBody = response.body() != null ? response.body().string() : "无响应内容";
                log.error("[DeepSeek客户端] 请求失败，状态码: {}, 响应: {}", response.code(), errorBody);
                throw new BusinessException(500, "DeepSeek API请求失败: " + response.code());
            }

            String responseBody = response.body() != null ? response.body().string() : "";
            JSONObject result = JSON.parseObject(responseBody);

            // 解析响应
            JSONArray choices = result.getJSONArray("choices");
            if (choices != null && !choices.isEmpty()) {
                JSONObject choice = choices.getJSONObject(0);
                JSONObject message = choice.getJSONObject("message");
                String content = message.getString("content");
                log.info("[DeepSeek客户端] AI生成成功，内容长度: {}", content.length());
                return content;
            }

            log.warn("[DeepSeek客户端] 响应中无有效内容");
            return "";

        } catch (IOException e) {
            log.error("[DeepSeek客户端] 请求异常", e);
            throw new BusinessException(500, "DeepSeek API请求异常: " + e.getMessage());
        }
    }

    /**
     * 生成日报/周报内容
     *
     * @param commits      提交记录列表（格式化后的字符串）
     * @param template     报告模板
     * @param reportType   报告类型（daily/weekly）
     * @return 生成的报告内容
     */
    public String generateReport(String commits, String template, String reportType) {
        String systemPrompt = """
            你是一个专业的软件开发工作报告生成助手。你的任务是根据提供的Git提交记录生成清晰、专业的工作报告。

            要求：
            1. 使用Markdown格式
            2. 分类整理提交记录，如：功能开发、Bug修复、代码优化、文档更新等
            3. 使用简洁专业的语言描述工作内容
            4. 不要编造不存在的内容
            5. 如果提交记录为空，生成一个简单的"无提交记录"报告
            6. 按照提供的模板格式输出，用实际内容替换模板中的占位符
            """;

        String reportTypeDesc = "daily".equals(reportType) ? "日报" : "周报";
        String userPrompt = String.format("""
            请根据以下Git提交记录生成一份%s。

            ## Git提交记录
            %s

            ## 报告模板
            %s

            请按照模板格式生成报告，将{{commits}}替换为整理后的提交内容摘要。
            """, reportTypeDesc, commits, template);

        return chat(systemPrompt, userPrompt);
    }

    /**
     * 生成按需求分组的日报内容
     *
     * @param structuredCommits 按需求分组后的结构化提交文本
     * @param template          日报模板
     * @return 生成的日报内容
     */
    public String generateDailyReportByRequirement(String structuredCommits, String template) {
        String systemPrompt = """
            你是一个专业的软件开发日报生成助手。

            任务要求：
            1. 严格基于输入内容输出，不编造不存在的需求和工作。
            2. 模板仅作为格式参考，绝对禁止照搬模板中的历史业务条目、需求编号、项目名或具体工作点。
            3. 输出内容必须完全来源于“结构化提交信息”。若模板与结构化提交信息冲突，以结构化提交信息为准。
            4. 输出格式必须是：
               今日工作内容：
               1. 需求编号【项目名】需求名（状态，环境）
                  1. 具体工作A
                  2. 具体工作B
            5. 对“其他工作”也要保留并输出，不可遗漏。
            6. 合并语义重复的提交信息，使用简洁中文描述。
            7. 若某需求无环境信息，只保留状态，不要额外补充环境。
            8. 一级条目使用阿拉伯数字编号，二级条目也使用阿拉伯数字编号。
            """;

        String userPrompt = String.format("""
            请根据以下“按需求分组的结构化提交信息”和模板生成今日日报。

            【结构化提交信息】
            %s

            【日报模板】
            %s
            """, structuredCommits, template);

        return chat(systemPrompt, userPrompt);
    }

    /**
     * 测试API连接
     *
     * @return 是否连接成功
     */
    public boolean testConnection() {
        String apiKey = getApiKey();
        if (apiKey == null || apiKey.isEmpty()) {
            return false;
        }

        try {
            String result = chat("你是一个测试助手", "请回复'连接成功'");
            return result != null && !result.isEmpty();
        } catch (Exception e) {
            log.error("[DeepSeek客户端] 连接测试失败", e);
            return false;
        }
    }
}
