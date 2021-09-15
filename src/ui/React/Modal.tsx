import React from "react";
import { makeStyles, createStyles, Theme } from "@material-ui/core";
import M from "@material-ui/core/Modal";
import Backdrop from "@material-ui/core/Backdrop";
import Fade from "@material-ui/core/Fade";

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    modal: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    paper: {
      backgroundColor: theme.palette.background.paper,
      border: "2px solid " + theme.palette.primary.main,
      boxShadow: theme.shadows[5],
      padding: theme.spacing(2, 4, 3),
      maxWidth: "80%",
      maxHeight: "80%",
      overflow: "auto",
      "&::-webkit-scrollbar": {
        // webkit
        display: "none",
      },
      scrollbarWidth: "none", // firefox
    },
  }),
);

interface IProps {
  open: boolean;
  onClose: () => void;
  children: JSX.Element[] | JSX.Element | React.ReactElement[] | React.ReactElement;
}

export const Modal = (props: IProps): React.ReactElement => {
  const classes = useStyles();
  return (
    <M
      open={props.open}
      onClose={props.onClose}
      closeAfterTransition
      className={classes.modal}
      BackdropComponent={Backdrop}
      BackdropProps={{
        timeout: 100,
      }}
    >
      <Fade in={props.open}>
        <div className={classes.paper}>{props.children}</div>
      </Fade>
    </M>
  );
};
