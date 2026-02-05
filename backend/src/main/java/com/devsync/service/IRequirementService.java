package com.devsync.service;

import com.devsync.dto.req.RequirementAddReq;
import com.devsync.dto.req.RequirementDeleteReq;
import com.devsync.dto.req.RequirementLinkReq;
import com.devsync.dto.req.RequirementListReq;
import com.devsync.dto.req.RequirementUpdateReq;
import com.devsync.dto.rsp.RequirementRsp;

import java.util.List;

/**
 * 需求服务接口
 *
 * @author xiaolei
 */
public interface IRequirementService {

    /**
     * 查询迭代下需求列表
     *
     * @param req 请求参数
     * @return 需求列表
     */
    List<RequirementRsp> listRequirements(RequirementListReq req);

    /**
     * 新增需求
     *
     * @param req 请求参数
     * @return 新增需求ID
     */
    Integer addRequirement(RequirementAddReq req);

    /**
     * 更新需求
     *
     * @param req 请求参数
     */
    void updateRequirement(RequirementUpdateReq req);

    /**
     * 删除需求
     *
     * @param req 请求参数
     */
    void deleteRequirement(RequirementDeleteReq req);

    /**
     * 关联需求到目标
     *
     * @param req 请求参数
     */
    void linkRequirement(RequirementLinkReq req);
}
