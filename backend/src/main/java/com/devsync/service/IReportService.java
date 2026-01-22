package com.devsync.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.devsync.common.result.PageResult;
import com.devsync.dto.req.ReportGenerateReq;
import com.devsync.dto.req.ReportListReq;
import com.devsync.dto.req.ReportUpdateReq;
import com.devsync.dto.rsp.ReportRsp;
import com.devsync.entity.Report;

/**
 * 报告服务接口
 *
 * @author xiaolei
 */
public interface IReportService extends IService<Report> {

    /**
     * 生成报告
     *
     * @param req 生成请求
     * @return 生成的报告
     */
    ReportRsp generateReport(ReportGenerateReq req);

    /**
     * 分页查询报告列表
     *
     * @param req 查询条件
     * @return 分页结果
     */
    PageResult<ReportRsp> listReports(ReportListReq req);

    /**
     * 获取报告详情
     *
     * @param id 报告ID
     * @return 报告详情
     */
    ReportRsp getReportDetail(Integer id);

    /**
     * 更新报告
     *
     * @param req 更新请求
     */
    void updateReport(ReportUpdateReq req);

    /**
     * 删除报告
     *
     * @param id 报告ID
     */
    void deleteReport(Integer id);
}
