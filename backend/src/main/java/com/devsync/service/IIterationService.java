package com.devsync.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.devsync.common.result.PageResult;
import com.devsync.dto.req.IterationAddReq;
import com.devsync.dto.req.IterationListReq;
import com.devsync.dto.req.IterationUpdateReq;
import com.devsync.dto.rsp.IterationRsp;
import com.devsync.entity.Iteration;

import java.util.List;

/**
 * 迭代服务接口
 *
 * @author xiaolei
 */
public interface IIterationService extends IService<Iteration> {

    /**
     * 分页查询迭代列表
     *
     * @param req 查询条件
     * @return 分页结果
     */
    PageResult<IterationRsp> listIterations(IterationListReq req);

    /**
     * 获取项目的所有迭代
     *
     * @param projectId 项目ID
     * @return 迭代列表
     */
    List<IterationRsp> listByProject(Integer projectId);

    /**
     * 获取迭代详情
     *
     * @param id 迭代ID
     * @return 迭代详情
     */
    IterationRsp getIterationDetail(Integer id);

    /**
     * 新增迭代
     *
     * @param req 新增请求
     * @return 迭代ID
     */
    Integer addIteration(IterationAddReq req);

    /**
     * 更新迭代
     *
     * @param req 更新请求
     */
    void updateIteration(IterationUpdateReq req);

    /**
     * 删除迭代
     *
     * @param id 迭代ID
     */
    void deleteIteration(Integer id);

    /**
     * 更新迭代状态
     *
     * @param id     迭代ID
     * @param status 新状态
     */
    void updateStatus(Integer id, String status);
}
