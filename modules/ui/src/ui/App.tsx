import "./style.scss";

import React from "react";
import { createHashRouter, RouterProvider } from "react-router-dom";
import Home from "./routes/Home";
import Root from "./routes/Root";
import Seed from "./routes/Seed";

const router = createHashRouter([
  {
    path: "/",
    element: <Root />,
    children: [
      {
        path: "/",
        element: <Home />,
      },
      {
        path: "/seed",
        element: <Seed />,
      },
    ],
  },
]);

export default () => {
  return <RouterProvider router={router} />;
};
