import logging


def setup_logger():
    formatter = logging.Formatter(
        fmt="%(asctime)s %(levelname)-8s %(process)d %(processName)-16s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    handler = logging.StreamHandler()
    handler.setFormatter(formatter)

    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    logger.addHandler(handler)
    return logger


log = setup_logger()
