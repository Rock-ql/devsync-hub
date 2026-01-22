package com.devsync.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.devsync.dto.req.ApiKeyCreateReq;
import com.devsync.dto.rsp.ApiKeyRsp;
import com.devsync.entity.ApiKey;

import java.util.List;

/**
 * API Key服务接口
 *
 * @author xiaolei
 */
public interface IApiKeyService extends IService<ApiKey> {

    /**
     * 创建API Key
     *
     * @param req 创建请求
     * @return 包含完整Key的响应
     */
    ApiKeyRsp createApiKey(ApiKeyCreateReq req);

    /**
     * 获取所有API Key
     *
     * @return API Key列表
     */
    List<ApiKeyRsp> listApiKeys();

    /**
     * 删除API Key
     *
     * @param id Key ID
     */
    void deleteApiKey(Integer id);

    /**
     * 验证API Key
     *
     * @param keyValue Key值
     * @return 是否有效
     */
    boolean validateApiKey(String keyValue);

    /**
     * 更新最后使用时间
     *
     * @param keyValue Key值
     */
    void updateLastUsedTime(String keyValue);
}
