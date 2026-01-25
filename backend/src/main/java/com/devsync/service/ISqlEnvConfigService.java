package com.devsync.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.devsync.dto.rsp.SqlEnvConfigRsp;
import com.devsync.entity.SqlEnvConfig;

import java.util.List;
import java.util.Map;

/**
 * SQL环境配置服务接口
 *
 * @author xiaolei
 */
public interface ISqlEnvConfigService extends IService<SqlEnvConfig> {

    /**
     * 获取项目环境列表
     */
    List<SqlEnvConfigRsp> listByProjectId(Integer projectId);

    /**
     * 批量获取项目环境列表
     */
    Map<Integer, List<SqlEnvConfigRsp>> listByProjectIds(List<Integer> projectIds);

    /**
     * 添加环境
     */
    void addEnv(Integer projectId, String envCode, String envName);

    /**
     * 删除环境
     */
    void deleteEnv(Integer projectId, String envCode);

    /**
     * 初始化默认环境
     */
    void initDefaultEnvs(Integer projectId, Integer userId);
}
