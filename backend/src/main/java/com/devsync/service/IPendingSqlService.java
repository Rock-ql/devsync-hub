package com.devsync.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.devsync.common.result.PageResult;
import com.devsync.dto.req.*;
import com.devsync.dto.rsp.PendingSqlRsp;
import com.devsync.entity.PendingSql;

import java.util.List;

/**
 * 待执行SQL服务接口
 *
 * @author xiaolei
 */
public interface IPendingSqlService extends IService<PendingSql> {

    /**
     * 分页查询SQL列表
     *
     * @param req 查询条件
     * @return 分页结果
     */
    PageResult<PendingSqlRsp> listSql(PendingSqlListReq req);

    /**
     * 获取SQL详情
     *
     * @param id SQL ID
     * @return SQL详情
     */
    PendingSqlRsp getSqlDetail(Integer id);

    /**
     * 新增SQL
     *
     * @param req 新增请求
     * @return SQL ID
     */
    Integer addSql(PendingSqlAddReq req);

    /**
     * 更新SQL
     *
     * @param req 更新请求
     */
    void updateSql(PendingSqlUpdateReq req);

    /**
     * 删除SQL
     *
     * @param id SQL ID
     */
    void deleteSql(Integer id);

    /**
     * 标记SQL为已执行
     *
     * @param req 执行请求
     */
    void executeSql(PendingSqlExecuteReq req);

    /**
     * 批量标记SQL为已执行
     *
     * @param req 批量执行请求
     */
    void batchExecuteSql(PendingSqlBatchExecuteReq req);

    /**
     * 获取项目的待执行SQL列表
     *
     * @param projectId 项目ID
     * @return SQL列表
     */
    List<PendingSqlRsp> listPendingByProject(Integer projectId);
}
