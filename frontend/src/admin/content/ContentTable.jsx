import { useRef, useState } from "react";
import {
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { ProTable } from "@ant-design/pro-components";
import { Button, Drawer, Popconfirm, message, Tooltip } from "antd";

import ModalCreateProduction from "./ModalCreateProduction";
import SeasonManager from "./SeasonManager";
import ProductionDetail from "./ProductionDetail";
import {
  GenreTags,
  PremiumTag,
  TypeTag,
} from "../../components/adminContent/ProductionTags";
import AnonymousBanner from "../../assets/anonymousBanner.png";
import {
  getMovies,
  getMovieBySlug,
  deleteProduction,
} from "../../services/movieService";

const ContentTable = () => {
  const actionRef = useRef();
  const [modalCreateOpen, setModalCreateOpen] = useState(false);
  const [editingProduction, setEditingProduction] = useState(null);
  const [managerDrawerOpen, setManagerDrawerOpen] = useState(false);
  const [currentManagerItem, setCurrentManagerItem] = useState(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [currentDetailItem, setCurrentDetailItem] = useState(null);

  const getMovieDetail = async (key, record) => {
    try {
      const fullData = await getMovieBySlug(record.slug);
      if (key === "view") {
        setCurrentDetailItem(fullData);
        setDetailDrawerOpen(true);
      } else if (key === "manage") {
        setCurrentManagerItem(fullData);
        setManagerDrawerOpen(true);
      } else if (key === "edit") {
        setEditingProduction(fullData);
        setModalCreateOpen(true);
      }
    } catch (error) {
      message.error("Lỗi khi tải dữ liệu chi tiết phim!");
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteProduction(id);
      message.success("Đã xóa phim và dọn sạch bộ nhớ R2!");

      actionRef.current?.reload();
    } catch (error) {
      console.error(error);
      message.error("Lỗi khi xóa phim!");
    }
  };

  const columns = [
    {
      title: "Poster",
      dataIndex: "poster_url",
      hideInSearch: true,
      width: 80,
      align: "center",
      render: (_, r) => (
        <figure className="flex items-center justify-center">
          <img
            src={r?.poster_url ? r.poster_url : AnonymousBanner}
            alt=""
            className="w-12 h-16 object-cover rounded shadow-sm"
          />
        </figure>
      ),
    },
    {
      title: "Tên",
      dataIndex: "title",
      copyable: true,
      render: (_, r) => (
        <div>
          <div className="font-bold">{r.title}</div>
          <div>
            <GenreTags genres={r.genres} />
          </div>
        </div>
      ),
    },
    {
      title: "Loại",
      dataIndex: "type",
      width: 120,
      align: "center",
      valueEnum: { movie: { text: "Phim Lẻ" }, series: { text: "Phim Bộ" } },
      render: (_, r) => <TypeTag type={r.type} />,
    },
    {
      title: "Chế độ",
      dataIndex: "is_premium",
      width: 100,
      align: "center",
      valueEnum: { true: { text: "VIP Only" }, false: { text: "Miễn phí" } },
      render: (_, r) => <PremiumTag isPremium={r.is_premium} />,
    },
    {
      title: "Ra mắt",
      dataIndex: "release_year",
      valueType: "number",
      width: 150,
      align: "center",
      render: (_, r) => <div>{r.release_year}</div>,
    },
    {
      title: "Hành động",
      valueType: "option",
      width: 180,
      align: "center",
      render: (_, record) => [
        <Tooltip title="Xem chi tiết" key="view">
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => getMovieDetail("view", record)}
          />
        </Tooltip>,
        <Tooltip title="Sửa thông tin" key="edit">
          <Button
            type="primary"
            ghost
            icon={<EditOutlined />}
            size="small"
            onClick={() => getMovieDetail("edit", record)}
          />
        </Tooltip>,
        <Tooltip title="Quản lý Content" key="manage">
          <Button
            icon={<SettingOutlined />}
            size="small"
            className="text-purple-600 border-purple-600"
            onClick={() => getMovieDetail("manage", record)}
          >
            {record.type === "series" ? "Mùa" : "File"}
          </Button>
        </Tooltip>,
        <Popconfirm
          key="del"
          title="Xóa phim này?"
          onConfirm={() => handleDelete(record.id)}
          okButtonProps={{ danger: true }}
        >
          <Button danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>,
      ],
    },
  ];

  return (
    <>
      <ProTable
        columns={columns}
        actionRef={actionRef}
        request={async (params) => {
          let data = await getMovies();
          if (params.title)
            data = data.filter((item) =>
              item.title.toLowerCase().includes(params.title.toLowerCase()),
            );
          if (params.type)
            data = data.filter((item) => item.type === params.type);
          if (params.is_premium)
            data = data.filter(
              (item) => item.is_premium === (params.is_premium === "true"),
            );
          if (params.release_year)
            data = data.filter(
              (item) => item.release_year.toString() === params.release_year,
            );
          return { data: data, success: true };
        }}
        rowKey="id"
        pagination={{ pageSize: 4 }}
        headerTitle="QUẢN LÝ KHO PHIM"
        toolBarRender={() => [
          <Button
            key="add"
            icon={<PlusOutlined />}
            type="primary"
            onClick={() => {
              setEditingProduction(null);
              setModalCreateOpen(true);
            }}
          >
            Thêm Mới
          </Button>,
        ]}
      />
      <ModalCreateProduction
        open={modalCreateOpen}
        setOpen={setModalCreateOpen}
        refreshTable={() => actionRef.current?.reload()}
        initialData={editingProduction}
      />
      <Drawer
        title={`Quản lý: ${currentManagerItem?.title}`}
        width={720}
        open={managerDrawerOpen}
        onClose={() => setManagerDrawerOpen(false)}
        destroyOnClose
      >
        {currentManagerItem && (
          <SeasonManager
            production={currentManagerItem}
            refreshData={() => getMovieDetail("manage", currentManagerItem)}
          />
        )}
      </Drawer>
      <Drawer
        title="Thông tin phim"
        width={1000}
        open={detailDrawerOpen}
        onClose={() => setDetailDrawerOpen(false)}
      >
        {currentDetailItem && <ProductionDetail data={currentDetailItem} />}
      </Drawer>
    </>
  );
};

export default ContentTable;
