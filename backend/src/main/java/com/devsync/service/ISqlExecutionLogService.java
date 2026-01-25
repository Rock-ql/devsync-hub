package com.devsync.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.devsync.entity.SqlExecutionLog;

import java.util.List;
import java.util.Map;

/**
 * SQL执行记录服务接口
 *
 * @author xiaolei
 */
public interface ISqlExecutionLogService extends IService<SqlExecutionLog> {

    /**
     * 新增执行记录
     */
    void createLog(Integer sqlId, String env, String executor, String remark);

    /**
     * 撤销执行记录
     */
    void revokeLog(Integer sqlId, String env);

    /**
     * 批量查询执行记录
     */
    List<SqlExecutionLog> listBySqlIds(List<Integer> sqlIds);

    /**
     * 批量统计执行次数
     */
    Map<Integer, Long> countExecutedBySqlIds(List<Integer> sqlIds);
}
