package com.devsync.service.impl;

import cn.hutool.core.bean.BeanUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.devsync.common.exception.BusinessException;
import com.devsync.dto.rsp.SqlEnvConfigRsp;
import com.devsync.entity.SqlEnvConfig;
import com.devsync.mapper.SqlEnvConfigMapper;
import com.devsync.service.ISqlEnvConfigService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * SQL环境配置服务实现
 *
 * @author xiaolei
 */
@Service
@RequiredArgsConstructor
public class SqlEnvConfigServiceImpl extends ServiceImpl<SqlEnvConfigMapper, SqlEnvConfig>
        implements ISqlEnvConfigService {

    private final SqlEnvConfigMapper sqlEnvConfigMapper;

    @Override
    public List<SqlEnvConfigRsp> listByProjectId(Integer projectId) {
        LambdaQueryWrapper<SqlEnvConfig> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SqlEnvConfig::getProjectId, projectId)
                .orderByAsc(SqlEnvConfig::getSortOrder)
                .orderByAsc(SqlEnvConfig::getId);
        return sqlEnvConfigMapper.selectList(wrapper).stream()
                .map(env -> {
                    SqlEnvConfigRsp rsp = new SqlEnvConfigRsp();
                    BeanUtil.copyProperties(env, rsp);
                    return rsp;
                })
                .toList();
    }

    @Override
    public Map<Integer, List<SqlEnvConfigRsp>> listByProjectIds(List<Integer> projectIds) {
        if (projectIds == null || projectIds.isEmpty()) {
            return Map.of();
        }
        LambdaQueryWrapper<SqlEnvConfig> wrapper = new LambdaQueryWrapper<>();
        wrapper.in(SqlEnvConfig::getProjectId, projectIds)
                .orderByAsc(SqlEnvConfig::getSortOrder)
                .orderByAsc(SqlEnvConfig::getId);
        return sqlEnvConfigMapper.selectList(wrapper).stream()
                .map(env -> {
                    SqlEnvConfigRsp rsp = new SqlEnvConfigRsp();
                    BeanUtil.copyProperties(env, rsp);
                    return rsp;
                })
                .collect(Collectors.groupingBy(SqlEnvConfigRsp::getProjectId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void addEnv(Integer projectId, String envCode, String envName) {
        throw new BusinessException(400, "环境固定为local/dev/test/smoke/prod，不支持自定义");
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteEnv(Integer projectId, String envCode) {
        throw new BusinessException(400, "环境固定为local/dev/test/smoke/prod，不支持删除");
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void initDefaultEnvs(Integer projectId, Integer userId) {
        int finalUserId = userId == null ? 1 : userId;
        List<SqlEnvConfig> defaults = List.of(
                buildEnv(projectId, finalUserId, "local", "local", 1),
                buildEnv(projectId, finalUserId, "dev", "dev", 2),
                buildEnv(projectId, finalUserId, "test", "test", 3),
                buildEnv(projectId, finalUserId, "smoke", "smoke", 4),
                buildEnv(projectId, finalUserId, "prod", "prod", 5)
        );
        for (SqlEnvConfig env : defaults) {
            LambdaQueryWrapper<SqlEnvConfig> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(SqlEnvConfig::getProjectId, projectId)
                    .eq(SqlEnvConfig::getEnvCode, env.getEnvCode());
            if (sqlEnvConfigMapper.selectCount(wrapper) == 0) {
                sqlEnvConfigMapper.insert(env);
            }
        }
    }

    private SqlEnvConfig buildEnv(Integer projectId, Integer userId, String code, String name, Integer sort) {
        SqlEnvConfig env = new SqlEnvConfig();
        env.setProjectId(projectId);
        env.setUserId(userId);
        env.setEnvCode(code);
        env.setEnvName(name);
        env.setSortOrder(sort);
        return env;
    }

}
